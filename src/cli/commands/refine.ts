import { Command } from 'commander';
import { FlowRefiner } from '../../recorder/refiner/flow-refiner.js';
import { logger } from '../ui/logger.js';
import { RefineOptions } from '../../recorder/refiner/types.js';

export function refineCommand() {
  const cmd = new Command('refine');

  cmd
    .description('Refine and optimize a recorded flow file')
    .argument('<flow>', 'Path to raw flow file (.raw.json)')
    .option('--no-auto-clean', 'Skip automatic rule-based cleanup')
    .option('--no-llm', 'Skip LLM-powered optimization')
    .option('-i, --interactive', 'Enable interactive step review')
    .option('-o, --output <path>', 'Custom output path for optimized flow')
    .option('--dry-run', 'Preview changes without saving')
    .action(async (flowPath, options) => {
      const refiner = new FlowRefiner();

      const refineOptions: RefineOptions = {
        autoClean: options.autoClean !== false,
        llmOptimize: options.llm !== false,
        interactive: options.interactive || false,
        outputPath: options.output,
        dryRun: options.dryRun || false,
      };

      try {
        await refiner.refine(flowPath, refineOptions);
      } catch (error) {
        logger.error(`Refine failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
