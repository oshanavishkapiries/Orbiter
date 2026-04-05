import { Command } from 'commander';
import { logger } from '../ui/logger.js';

export function replayCommand() {
  const cmd = new Command('replay');

  cmd
    .description('Replay a saved flow without LLM')
    .argument('<flow>', 'Path to flow file (.flow.json)')
    .option('-p, --params <json>', 'Parameters as JSON string')
    .option('--params-file <path>', 'Parameters file path')
    .option('--headless', 'Run browser in headless mode')
    .action(async (flow, options) => {
      logger.info(`Replaying flow: ${flow}`);
      
      // TODO: Implement in Phase 3
      logger.info('Replay command not yet implemented. Coming in Phase 3.');
    });

  return cmd;
}