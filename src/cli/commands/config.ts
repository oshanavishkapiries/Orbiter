import { Command } from 'commander';
import { config } from '../../config/index.js';
import { logger } from '../ui/logger.js';

export function configCommand() {
  const cmd = new Command('config');

  cmd
    .description('View or manage configuration')
    .option('-s, --show', 'Show current configuration')
    .option('--init', 'Create default configuration file')
    .action(async (options) => {
      if (options.show) {
        const cfg = config();
        console.log('\nCurrent Configuration:');
        console.log(JSON.stringify(cfg, null, 2));
      } else if (options.init) {
        // TODO: Create config file
        logger.info('Config init not yet implemented.');
      } else {
        cmd.help();
      }
    });

  return cmd;
}
