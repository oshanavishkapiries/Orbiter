import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileManager } from '../../browser/profile-manager.js';
import { logger } from '../ui/logger.js';

export function profileCommand() {
  const cmd = new Command('profile');

  cmd
    .description(
      'Manage browser profiles (persistent login sessions per site/account)',
    )
    .addCommand(profileListCommand())
    .addCommand(profileCreateCommand())
    .addCommand(profileInfoCommand());

  return cmd;
}

// ─── orbiter profile list ────────────────────────────────────────────────────

function profileListCommand() {
  return new Command('list')
    .description('List all saved browser profiles')
    .action(() => {
      const mgr = new ProfileManager();
      const profiles = mgr.listProfiles();

      console.log('\n' + chalk.bold('Browser Profiles'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(
        chalk.gray(
          '  Profiles are persistent browser sessions — cookies, localStorage,\n' +
            '  and login state are saved between runs automatically.',
        ),
      );
      console.log('');

      for (const p of profiles) {
        const hasSaved = mgr.hasSavedState(p.path);
        const stateTag = hasSaved
          ? chalk.green(' [has saved sessions]')
          : chalk.gray(' [fresh — no saved state]');

        const lastUsed = p.lastUsedAt
          ? chalk.gray('Last used: ' + new Date(p.lastUsedAt).toLocaleString())
          : chalk.gray('Never used');

        console.log(`  ${chalk.cyan.bold(p.name)}${stateTag}`);
        if (p.description) console.log(`    ${chalk.gray(p.description)}`);
        console.log(`    Path: ${chalk.dim(p.path)}`);
        console.log(`    ${lastUsed}`);
        console.log('');
      }

      console.log(chalk.gray('Usage:'));
      console.log(
        chalk.gray(
          '  orbiter run "task" -p default          # default profile',
        ),
      );
      console.log(
        chalk.gray('  orbiter run "task" -p work             # named profile'),
      );
      console.log(
        chalk.gray(
          '  orbiter profile create <name>          # create a new profile',
        ),
      );
      console.log('');
    });
}

// ─── orbiter profile create <name> ───────────────────────────────────────────

function profileCreateCommand() {
  return new Command('create')
    .description('Create a new named browser profile')
    .argument('<name>', 'Profile name (letters, numbers, hyphens)')
    .option('-d, --description <text>', 'Optional description')
    .action((name: string, options: { description?: string }) => {
      const mgr = new ProfileManager();

      try {
        const profile = mgr.createProfile(name, options.description);

        console.log('\n' + chalk.green.bold('Profile created'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`  Name: ${chalk.cyan(profile.name)}`);
        console.log(`  Path: ${chalk.dim(profile.path)}`);
        console.log('');
        console.log(chalk.gray('To use this profile:'));
        console.log(
          chalk.white(`  orbiter run "your task" -p ${profile.name}`),
        );
        console.log('');
        console.log(
          chalk.gray(
            '  On the first run it will open a fresh browser. Log in to your\n' +
              '  sites manually or via automation. From the second run onward,\n' +
              '  Orbiter will reuse those saved sessions — no login needed.',
          ),
        );
        console.log('');
      } catch (err) {
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}

// ─── orbiter profile info <name> ─────────────────────────────────────────────

function profileInfoCommand() {
  return new Command('info')
    .description('Show details about a specific profile')
    .argument('<name>', 'Profile name or "default"')
    .action((name: string) => {
      const mgr = new ProfileManager();
      const profiles = mgr.listProfiles();
      const profile = profiles.find((p) => p.name === name);

      if (!profile) {
        logger.error(`Profile "${name}" not found. Run: orbiter profile list`);
        process.exit(1);
      }

      const hasSaved = mgr.hasSavedState(profile.path);

      console.log('\n' + chalk.bold(`Profile: ${profile.name}`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  Path:        ${chalk.dim(profile.path)}`);
      console.log(
        `  Saved state: ${hasSaved ? chalk.green('yes — cookies & sessions stored') : chalk.gray('none yet')}`,
      );

      if (profile.createdAt) {
        console.log(
          `  Created:     ${chalk.gray(new Date(profile.createdAt).toLocaleString())}`,
        );
      }
      if (profile.lastUsedAt) {
        console.log(
          `  Last used:   ${chalk.gray(new Date(profile.lastUsedAt).toLocaleString())}`,
        );
      }
      if (profile.description) {
        console.log(`  Description: ${chalk.gray(profile.description)}`);
      }

      console.log('');
      console.log(chalk.gray('How browser persistence works:'));
      console.log(
        chalk.gray(
          '  Playwright stores cookies, localStorage, IndexedDB, and\n' +
            '  session tokens in this directory. Every time you run with\n' +
            '  -p ' +
            name +
            ', the browser restores this state — just like\n' +
            '  Chrome remembers your logins across restarts.',
        ),
      );
      console.log('');
    });
}
