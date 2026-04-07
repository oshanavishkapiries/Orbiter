import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { runCommand } from './commands/run.js';
import { replayCommand } from './commands/replay.js';
import { refineCommand } from './commands/refine.js';
import { configCommand } from './commands/config.js';
import { profileCommand } from './commands/profile.js';
import { modelsCommand } from './commands/models.js';

const VERSION = '1.0.0';

export function createCLI() {
  const program = new Command();

  // Banner
  const banner = boxen(
    `${chalk.bold.cyan('🚀 ORBITER')} ${chalk.gray(`v${VERSION}`)}\n${chalk.dim('AI-powered browser automation')}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    },
  );

  program
    .name('orbiter')
    .description('AI-powered browser automation tool')
    .version(VERSION, '-v, --version', 'Show version number')
    .addHelpText('beforeAll', banner);

  // Commands
  program.addCommand(runCommand());
  program.addCommand(replayCommand());
  program.addCommand(refineCommand());
  program.addCommand(configCommand());
  program.addCommand(profileCommand());
  program.addCommand(modelsCommand());

  return program;
}
