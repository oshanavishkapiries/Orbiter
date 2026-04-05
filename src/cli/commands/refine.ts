import { Command } from 'commander';
import { logger } from '../ui/logger.js';

export function refineCommand() {
  const cmd = new Command('refine');

  cmd
    .description('Refine and optimize a recorded flow')
    .argument('<flow>', 'Path to raw flow file (.raw.json)')
    .option('--no-llm', 'Skip LLM optimization, only rule-based cleanup')
    .option('-i, --interactive', 'Interactive review mode')
    .option('-o, --output <path>', 'Output path for refined flow')
    .action(async (flow, options) => {
      logger.info(`Refining flow: ${flow}`);

      // TODO: Implement in Phase 6
      logger.info('Refine command not yet implemented. Coming in Phase 6.');
    });

  return cmd;
}
