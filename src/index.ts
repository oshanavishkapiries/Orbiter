#!/usr/bin/env node

import { program } from 'commander';
import { run } from './cli/commands/run.js';
import { replay } from './cli/commands/replay.js';
import { refine } from './cli/commands/refine.js';
import { config } from './cli/commands/config.js';

program
  .name('orbiter')
  .description('AI-powered browser automation')
  .version('1.0.0');

program
  .command('run')
  .description('Run a prompt')
  .argument('<prompt>')
  .action(run);
program
  .command('replay')
  .description('Replay a flow')
  .argument('<flow>')
  .action(replay);
program
  .command('refine')
  .description('Refine a flow')
  .argument('<flow>')
  .action(refine);
program.command('config').description('Manage configuration').action(config);

program.parse();
