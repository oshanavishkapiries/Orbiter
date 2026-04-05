import { Command } from 'commander';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';

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
      logger.info(`Starting task: ${prompt}`);
      
      // TODO: Implement in Phase 1+
      const sp = spinner('Initializing Orbiter...').start();
      
      setTimeout(() => {
        sp.succeed('Orbiter initialized');
        logger.info('Run command not yet implemented. Coming in Phase 1.');
      }, 1000);
    });

  return cmd;
}