import { Command } from 'commander';
import { logger, spinner } from '../ui/logger.js';
import { banners } from '../ui/banner.js';
import { summaries, ExecutionSummary } from '../ui/summary.js';
import { Timeline } from '../ui/timeline.js';
import { ReportGenerator, ReportData, ReportStep } from '../ui/report.js';
import { ExecutionContext } from '../../core/execution-context.js';
import { TaskPlanner } from '../../core/planner.js';
import { TaskExecutor } from '../../core/executor.js';
import { PromptEnhancer } from '../../core/prompt-enhancer.js';
import { LLMFactory } from '../../llm/factory.js';
import { initializeTools } from '../../tools/index.js';
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
    .option('--max-steps <number>', 'Maximum steps to execute', '50')
    .option('--report', 'Generate execution report')
    .option(
      '--report-format <format>',
      'Report format: markdown or json',
      'markdown',
    )
    .option('-e, --enhance', 'Enhance the prompt with AI before execution')
    .action(async (prompt, options) => {
      // Banner
      console.log(banners.run(prompt));

      const startTime = Date.now();
      const timeline = new Timeline();
      const context = new ExecutionContext();
      const errors: string[] = [];

      // Wire --no-record into config so executor picks it up
      if (options.record === false) {
        config().recording.enabled = false;
      }

      // Graceful shutdown on Ctrl-C / SIGTERM
      const onSignal = async () => {
        logger.warn('\nInterrupt received, shutting down...');
        await context.cleanup();
        process.exit(0);
      };
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);

      timeline.add({
        type: 'start',
        message: 'Execution started',
      });

      try {
        // Initialize
        const sp = spinner('Initializing...').start();

        initializeTools();
        sp.text('Tools registered');

        await context.initialize({
          headless: options.headless,
          profilePath: options.profile,
        });
        sp.text('Browser launched');

        const llm = LLMFactory.create(undefined, options.model);
        const modelInfo = (llm as any).getModelInfo?.() || {
          name: config().llm.model,
          provider: config().llm.provider,
        };

        // Fetch live model capabilities from OpenRouter (vision support, modality, etc.)
        sp.text('Checking model capabilities...');
        await llm.loadCapabilities();

        const visionEnabled = llm.supportsVision();
        sp.succeed(
          `Ready (${modelInfo.provider}/${modelInfo.name}) vision=${visionEnabled ? 'on' : 'off'}`,
        );

        timeline.add({
          type: 'step',
          status: 'success',
          message: 'Initialization complete',
        });

        // Prompt enhancement phase (optional)
        let activePrompt = prompt;

        if (options.enhance) {
          logger.phase('PROMPT ENHANCEMENT PHASE');

          const enhanceSp = spinner('Enhancing prompt...').start();
          const enhancer = new PromptEnhancer(llm);
          const enhanceResult = await enhancer.enhance(prompt);
          enhanceSp.succeed(`Prompt enhanced (${enhanceResult.tokensUsed} tokens)`);

          console.log(chalk.gray('\n  Original: ') + chalk.dim(enhanceResult.original));
          console.log(
            chalk.cyan('\n  Enhanced:\n') +
            chalk.white(
              enhanceResult.enhanced
                .split('\n')
                .map((line) => `  ${line}`)
                .join('\n'),
            ) + '\n',
          );

          activePrompt = enhanceResult.enhanced;

          timeline.add({
            type: 'step',
            status: 'success',
            message: 'Prompt enhanced',
          });
        }

        // Planning phase
        logger.phase('PLANNING PHASE');

        const planner = new TaskPlanner(llm);
        const plan = await planner.plan(activePrompt);

        console.log(chalk.blue('\nLLM Analysis:'));
        console.log(chalk.gray(plan.reasoning.slice(0, 200) + '...'));
        console.log('');

        logger.bullet(`Estimated steps: ${plan.estimatedSteps}`);
        logger.bullet(
          `Pattern detection needed: ${plan.needsDetection ? 'Yes' : 'No'}`,
        );

        timeline.add({
          type: 'step',
          status: 'success',
          message: `Planning complete (${plan.estimatedSteps} steps estimated)`,
        });

        // Execution phase
        logger.phase('EXECUTION PHASE');

        const executor = new TaskExecutor(
          llm,
          context,
          plan,
          modelInfo.provider,
          modelInfo.name,
        );

        const result = await executor.execute(parseInt(options.maxSteps));

        // Record timeline events from steps
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

        timeline.add({
          type: 'end',
          message: 'Execution complete',
        });

        // Summary
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
          flowPath: result.flowPath,
          outputFiles: result.outputFiles,
        };

        summaries.execution(summaryData);

        // Generate report if requested
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
            steps: result.steps.map(
              (s): ReportStep => ({
                id: s.stepNumber,
                tool: s.toolName,
                params: s.params,
                status: s.success ? 'success' : 'failed',
                duration: s.duration,
                error: s.error,
              }),
            ),
            tokensUsed: result.summary.tokensUsed,
            estimatedCost,
            flowPath: result.flowPath,
            outputFiles: result.outputFiles,
            errors,
          };

          reportGen.save(reportData, options.reportFormat);
        }
      } catch (error) {
        const err = error as Error;
        logger.error(`Execution failed: ${err.message}`);

        timeline.add({
          type: 'error',
          status: 'failed',
          message: err.message,
        });

        console.log(banners.error(err.message));

        if (err.message.includes('API key')) {
          console.log(
            chalk.yellow('\nTip: Set OPENROUTER_API_KEY in your .env file'),
          );
        }

        process.exit(1);
      } finally {
        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);
        await context.cleanup();
      }
    });

  return cmd;
}
