import { Command } from 'commander';
import { logger, spinner } from '../ui/logger.js';
import { banners } from '../ui/banner.js';
import { summaries, ExecutionSummary } from '../ui/summary.js';
import { Timeline } from '../ui/timeline.js';
import { ReportGenerator, ReportData, ReportStep } from '../ui/report.js';
import { ExecutionContext } from '../../core/execution-context.js';
import { TaskPlanner } from '../../core/planner.js';
import { TaskExecutor } from '../../core/executor.js';
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
    .action(async (prompt, options) => {
      // Banner
      console.log(banners.run(prompt));

      const startTime = Date.now();
      const timeline = new Timeline();
      const context = new ExecutionContext();
      const errors: string[] = [];

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

        sp.succeed(`Ready (${modelInfo.provider}/${modelInfo.name})`);

        timeline.add({
          type: 'step',
          status: 'success',
          message: 'Initialization complete',
        });

        // Planning phase
        logger.phase('PLANNING PHASE');

        const planner = new TaskPlanner(llm);
        const plan = await planner.plan(prompt);

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
        const summaryData: ExecutionSummary = {
          success: result.success,
          totalSteps: result.summary.totalSteps,
          successfulSteps: result.summary.successfulSteps,
          failedSteps: result.summary.failedSteps,
          duration: result.summary.duration,
          tokensUsed: result.summary.tokensUsed,
          estimatedCost: (result.summary.tokensUsed / 1_000_000) * 3,
          flowPath: result.flowPath,
          outputFiles: result.outputFiles,
        };

        summaries.execution(summaryData);

        // Generate report if requested
        if (options.report) {
          const reportGen = new ReportGenerator();

          const reportData: ReportData = {
            taskName: prompt.slice(0, 50),
            goal: prompt,
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
            estimatedCost: (result.summary.tokensUsed / 1_000_000) * 3,
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
        await context.cleanup();
      }
    });

  return cmd;
}
