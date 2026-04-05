import { Command } from 'commander';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import { ExecutionContext } from '../../core/execution-context.js';
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
    .action(async (prompt, options) => {
      console.log('\n' + chalk.cyan.bold('🚀 ORBITER - Browser Automation'));
      console.log(chalk.gray('─'.repeat(50)) + '\n');

      logger.info(`Task: ${prompt}`);

      const context = new ExecutionContext();

      try {
        // Initialize
        const sp = spinner('Initializing browser...').start();

        await context.initialize({
          headless: options.headless,
          profilePath: options.profile,
        });

        sp.succeed('Browser initialized');

        // Test navigation
        const navSp = spinner('Testing navigation...').start();

        const browser = context.getBrowserManager();
        await browser.navigate('https://example.com');

        navSp.succeed(`Navigated to: ${browser.getUrl()}`);

        // Test page info
        const title = await browser.getTitle();
        logger.info(`Page title: ${title}`);

        // Test screenshot
        const ssSp = spinner('Taking screenshot...').start();
        const screenshotPath = await browser.screenshot({
          fullPage: true,
        });
        ssSp.succeed(`Screenshot saved: ${screenshotPath}`);

        // Test page utils
        const pageUtils = context.getPageUtils();
        const elementCount = await pageUtils.getElementCount('*');
        logger.info(`Total elements on page: ${elementCount}`);

        // Summary
        const summary = context.getSummary();
        console.log('\n' + chalk.green('✓ Test Complete'));
        console.log(
          chalk.gray(`  Duration: ${(summary.duration / 1000).toFixed(1)}s`),
        );

        console.log(
          '\n' + chalk.yellow('Note: Full LLM integration coming in Phase 2'),
        );
      } catch (error) {
        logger.error(`Execution failed: ${(error as Error).message}`);
        throw error;
      } finally {
        await context.cleanup();
      }
    });

  return cmd;
}
