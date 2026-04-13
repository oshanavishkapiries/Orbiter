import { Command } from 'commander';
import { setVerbosity, getVerbosity } from './ui/logger.js';

/**
 * Add global options to all commands
 */
export function addGlobalOptions(program: Command): void {
  program
    .option('-v, --verbose', 'Verbose output (more details)')
    .option('-q, --quiet', 'Quiet mode (minimal output)')
    .option('--debug', 'Debug mode (all logging)')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();

      if (opts.debug) {
        setVerbosity('debug');
      } else if (opts.verbose) {
        setVerbosity('verbose');
      } else if (opts.quiet) {
        setVerbosity('quiet');
      } else {
        setVerbosity('normal');
      }
    });
}
