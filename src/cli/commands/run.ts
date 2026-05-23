import { Command } from 'commander';
import { logger, spinner } from '../ui/logger.js';
import { banners } from '../ui/banner.js';
import { summaries, ExecutionSummary } from '../ui/summary.js';
import { Timeline } from '../ui/timeline.js';
import { ReportGenerator, ReportData, ReportStep } from '../ui/report.js';
import { ExecutionContext } from '../../core/execution-context.js';
import { TaskExecutor } from '../../core/executor.js';
import { PromptEnhancer } from '../../core/prompt-enhancer.js';
import { LLMFactory } from '../../llm/factory.js';
import { initializeTools } from '../../tools/index.js';
import { McpClient } from '../../mcp/client.js';
import { config } from '../../config/index.js';
import chalk from 'chalk';

export function runCommand() {
  const cmd = new Command('run');

  cmd
    .description('Run a browser automation task with LLM guidance')
    .argument('<prompt>', 'Task description or goal')
    .option('-m, --model <model>', 'LLM model to use')
    .option('-p, --profile <path>', 'Browser profile path')
    .option('--headless', 'Run browser in headless mode')
    .option('--no-record', 'Disable flow recording')
    .option('--max-steps <number>', 'Maximum steps to execute (default: reads from DB settings)')
    .option('--report', 'Generate execution report')
    .option('--report-format <format>', 'Report format: markdown or json', 'markdown')
    .option('-e, --enhance', 'Enhance the prompt with AI before execution')
    .option('--no-enhance', 'Disable prompt enhancement for this run')
    .option('--highlight', 'Highlight interactive elements in the browser after each step')
    .action(async (prompt, options) => {
      console.log(banners.run(prompt));

      const startTime = Date.now();
      const timeline = new Timeline();
      const cfg = config();
      const context = new ExecutionContext();
      const mcpClient = new McpClient();
      const errors: string[] = [];
      const shouldEnhance =
        typeof options.enhance === 'boolean'
          ? options.enhance
          : cfg.promptEnhancer.enabled;

      if (options.record === false) {
        cfg.recording.enabled = false;
      }

      const onSignal = async () => {
        logger.warn('\nInterrupt received, shutting down...');
        await mcpClient.disconnect();
        await context.cleanup();
        process.exit(0);
      };
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);

      timeline.add({ type: 'start', message: 'Execution started' });

      try {
        const sp = spinner('Initializing...').start();

        initializeTools();
        sp.text('Tools registered');

        const mcpOptions = {
          headless: options.headless ?? cfg.browser.headless,
          userDataDir: options.profile ?? cfg.browser.profilePath,
          executablePath: cfg.browser.executablePath,
          browser: (cfg.browser.channel as any) ?? undefined,
          viewport: cfg.browser.viewport,
        };

        sp.text('Starting Playwright MCP server...');
        await mcpClient.connect(mcpOptions);
        context.setMcpClient(mcpClient);

        sp.text('Checking model capabilities...');
        const llm = LLMFactory.create(undefined, options.model);
        const modelInfo = (llm as any).getModelInfo?.() || {
          name: cfg.llm.model,
          provider: cfg.llm.provider,
        };
        await llm.loadCapabilities();

        const visionEnabled = llm.supportsVision();
        sp.succeed(
          `Ready (${modelInfo.provider}/${modelInfo.name}) vision=${visionEnabled ? 'on' : 'off'}`,
        );

        timeline.add({ type: 'step', status: 'success', message: 'Initialization complete' });

        let activePrompt = prompt;

        if (shouldEnhance) {
          logger.phase('PROMPT ENHANCEMENT');
          const enhanceSp = spinner('Enhancing prompt...').start();
          const enhancer = new PromptEnhancer(llm);
          const enhanceResult = await enhancer.enhance(prompt);
          enhanceSp.succeed(`Prompt enhanced (${enhanceResult.tokensUsed} tokens)`);

          console.log(chalk.gray('\n  Original: ') + chalk.dim(enhanceResult.original));
          console.log(
            chalk.cyan('\n  Enhanced:\n') +
            chalk.white(
              enhanceResult.enhanced.split('\n').map((line) => `  ${line}`).join('\n'),
            ) + '\n',
          );

          activePrompt = enhanceResult.enhanced;
          timeline.add({ type: 'step', status: 'success', message: 'Prompt enhanced' });
        }

        logger.phase('EXECUTION');

        const executor = new TaskExecutor(
          llm,
          context,
          activePrompt,
          modelInfo.provider,
          modelInfo.name,
          !!options.highlight,
        );

        const result = await executor.execute(options.maxSteps ? parseInt(options.maxSteps) : undefined);

        for (const step of result.steps) {
          timeline.add({
            type: 'step',
            tool: step.toolName,
            status: step.success ? 'success' : 'failed',
            message: step.success
              ? `${step.toolName} completed`
              : `${step.toolName} failed: ${step.error}`,
            duration: step.duration,
          });
          if (!step.success && step.error) {
            errors.push(step.error);
          }
        }

        const endTime = Date.now();
        timeline.add({ type: 'end', message: 'Execution complete' });

        const caps = (llm as any).getCapabilities?.();
        const estimatedCost = caps
          ? (result.summary.inputTokens / 1_000_000) * caps.inputPricePerMToken +
            (result.summary.outputTokens / 1_000_000) * caps.outputPricePerMToken
          : (result.summary.tokensUsed / 1_000_000) * 3;

        const summaryData: ExecutionSummary = {
          success: result.success,
          totalSteps: result.summary.totalSteps,
          successfulSteps: result.summary.successfulSteps,
          failedSteps: result.summary.failedSteps,
          duration: result.summary.duration,
          tokensUsed: result.summary.tokensUsed,
          estimatedCost,
          flowId: result.flowId,
          outputs: result.outputs,
        };

        summaries.execution(summaryData);

        if (options.report) {
          const reportGen = new ReportGenerator();
          const reportData: ReportData = {
            taskName: activePrompt.slice(0, 50),
            goal: activePrompt,
            startTime,
            endTime,
            success: result.success,
            totalSteps: result.summary.totalSteps,
            successfulSteps: result.summary.successfulSteps,
            failedSteps: result.summary.failedSteps,
            recoveredSteps: 0,
            steps: result.steps.map((s): ReportStep => ({
              id: s.stepNumber,
              tool: s.toolName,
              params: s.params,
              status: s.success ? 'success' : 'failed',
              duration: s.duration,
              error: s.error,
            })),
            tokensUsed: result.summary.tokensUsed,
            estimatedCost,
            flowId: result.flowId,
            outputs: result.outputs,
            errors,
          };
          await reportGen.save(reportData, options.reportFormat, result.sessionId);
        }
      } catch (error) {
        const err = error as Error;
        logger.error(`Execution failed: ${err.message}`);
        timeline.add({ type: 'error', status: 'failed', message: err.message });
        console.log(banners.error(err.message));

        if (err.message.includes('API key')) {
          console.log(chalk.yellow('\nTip: Set LLM_PROVIDER and the matching API key in your .env file'));
        }

        process.exit(1);
      } finally {
        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);
        await mcpClient.disconnect();
        await context.cleanup();
      }
    });

  return cmd;
}
