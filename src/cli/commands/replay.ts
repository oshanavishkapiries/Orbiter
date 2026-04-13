import { Command } from 'commander';
import { FlowReplayer } from '../../recorder/replayer.js';
import { logger } from '../ui/logger.js';

export function replayCommand() {
  const cmd = new Command('replay');

  cmd
    .description('Replay a saved flow without LLM (zero cost)')
    .argument('<flow>', 'Path to flow file (.raw.json or .flow.json)')
    .option('--params <json>', 'Parameters as JSON string')
    .option('--params-file <path>', 'Parameters from JSON file')
    .option('--headless', 'Run browser in headless mode')
    .option('-p, --profile <path>', 'Browser profile path')
    .option('--stop-on-error', 'Stop replay on first error')
    .option('--screenshot-steps', 'Take screenshot after each step')
    .option('--skip <steps>', 'Comma-separated step IDs to skip')
    .action(async (flowPath, options) => {
      const replayer = new FlowReplayer();

      try {
        const skipSteps = options.skip
          ? options.skip.split(',').map(Number)
          : [];

        await replayer.replay(flowPath, {
          parameters: options.params ? JSON.parse(options.params) : undefined,
          parametersFile: options.paramsFile,
          headless: options.headless,
          profilePath: options.profile,
          stopOnError: options.stopOnError,
          screenshotOnStep: options.screenshotSteps,
          skipSteps,
        });
      } catch (error) {
        logger.error(`Replay failed: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        await replayer.cleanup();
      }
    });

  return cmd;
}
