import { Command } from 'commander';
import { banners } from './ui/banner.js';
import { addGlobalOptions } from './global-options.js';
import { runCommand } from './commands/run.js';
import { replayCommand } from './commands/replay.js';
import { refineCommand } from './commands/refine.js';
import { configCommand } from './commands/config.js';
import { profileCommand } from './commands/profile.js';
import { modelsCommand } from './commands/models.js';
import { memoryCommand } from './commands/memory.js';

const VERSION = '1.0.0';

export function createCLI() {
  const program = new Command();

  program
    .name('orbiter')
    .description('AI-powered browser automation tool')
    .version(VERSION, '-V, --version', 'Show version number')
    .addHelpText('beforeAll', banners.main());

  // Add global options
  addGlobalOptions(program);

  // Register commands
  program.addCommand(runCommand());
  program.addCommand(replayCommand());
  program.addCommand(refineCommand());
  program.addCommand(configCommand());
  program.addCommand(profileCommand());
  program.addCommand(modelsCommand());
  program.addCommand(memoryCommand());

  // Help command customization
  program.configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name(),
  });

  // Custom help
  program.addHelpText(
    'after',
    `
${'\x1b[36m'}Examples:${'\x1b[0m'}
  $ orbiter run "Extract hotels from booking.com"
  $ orbiter run "Fill login form" --headless
  $ orbiter replay flows/my-flow.flow.json
  $ orbiter refine flows/raw-flow.raw.json -i

${'\x1b[36m'}Documentation:${'\x1b[0m'}
  https://github.com/orbiter-ai/orbiter
`,
  );

  return program;
}
