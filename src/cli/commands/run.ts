import { Command } from 'commander';
import { logger } from '../ui/logger.js';
import { ExecutionContext } from '../../core/execution-context.js';
import { TaskPlanner } from '../../core/planner.js';
import { TaskExecutor } from '../../core/executor.js';
import { LLMFactory } from '../../llm/factory.js';
import { initializeTools } from '../../tools/index.js';
import chalk from 'chalk';
import boxen from 'boxen';

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
    .action(async (prompt, options) => {
      // Banner
      console.log(
        '\n' +
          boxen(
            chalk.cyan.bold('🚀 ORBITER') + chalk.gray(' - Browser Automation'),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'cyan',
            },
          ),
      );

      logger.info(`Task: ${chalk.bold(prompt)}`);
      console.log(chalk.gray('─'.repeat(60)) + '\n');

      const context = new ExecutionContext();

      try {
        // Initialize tools
        logger.info('Initializing tools...');
        initializeTools();
        logger.success('Tools registered');

        // Initialize browser
        logger.info('Launching browser...');
        await context.initialize({
          headless: options.headless,
          profilePath: options.profile,
        });
        logger.success('Browser ready');

        // Initialize LLM
        logger.info('Connecting to LLM...');
        const llm = LLMFactory.create(undefined, options.model);

        const modelInfo = (llm as any).getModelInfo?.() || {
          name: 'unknown',
          provider: 'unknown',
        };

        logger.success(`LLM ready (${modelInfo.provider}/${modelInfo.name})`);

        console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');

        // Plan task
        logger.info(chalk.bold('PLANNING PHASE'));
        const planner = new TaskPlanner(llm);
        const plan = await planner.plan(prompt);

        console.log('\n' + chalk.blue('LLM Analysis:'));
        console.log(
          boxen(plan.reasoning, {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'blue',
          }),
        );

        console.log(
          `\n${chalk.gray('Estimated steps:')} ${plan.estimatedSteps}`,
        );
        console.log(
          `${chalk.gray('Pattern detection needed:')} ${plan.needsDetection ? 'Yes' : 'No'}`,
        );

        console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');

        // Execute task
        logger.info(chalk.bold('EXECUTION PHASE'));

        const executor = new TaskExecutor(
          llm,
          context,
          plan,
          modelInfo.provider,
          modelInfo.name,
        );
        const result = await executor.execute(parseInt(options.maxSteps));

        console.log(chalk.cyan('━'.repeat(60)) + '\n');

        // Display results
        if (result.success) {
          console.log(
            chalk.green.bold('✅ TASK COMPLETED SUCCESSFULLY') + '\n',
          );
        } else {
          console.log(
            chalk.yellow.bold('⚠️  TASK COMPLETED WITH ERRORS') + '\n',
          );
        }

        // Show performance metrics
        console.log(chalk.bold('Performance:'));
        console.log(
          `  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`,
        );
        console.log(
          `  LLM tokens: ${result.summary.tokensUsed.toLocaleString()}`,
        );

        const estimatedCost = (
          (result.summary.tokensUsed / 1000000) *
          3
        ).toFixed(4);
        console.log(`  Estimated cost: $${estimatedCost} 💰`);

        // Next steps
        if (options.record) {
          console.log('\n' + chalk.bold('Next steps:'));
          console.log('  • Flow saved to: ./flows/[flow-name].raw.json');
          console.log(
            '  • Optimize flow: orbiter refine flows/[flow-name].raw.json',
          );
          console.log(
            '  • Replay flow: orbiter replay flows/[flow-name].flow.json',
          );
        }

        console.log('');
      } catch (error) {
        console.log('\n' + chalk.red.bold('❌ EXECUTION FAILED') + '\n');
        logger.error(`Error: ${(error as Error).message}`);

        if ((error as Error).message.includes('API key')) {
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
