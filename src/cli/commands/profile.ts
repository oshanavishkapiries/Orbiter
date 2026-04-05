import { Command } from 'commander';
import { ProfileManager } from '../../browser/profile-manager.js';
import { logger } from '../ui/logger.js';

export function profileCommand() {
  const cmd = new Command('profile');

  cmd
    .description('Manage browser profiles')
    .option('-l, --list', 'List available Chrome profiles')
    .option('-v, --validate <path>', 'Validate a profile path')
    .action(async (options) => {
      const manager = new ProfileManager();

      if (options.list) {
        await manager.displayProfiles();
      } else if (options.validate) {
        const isValid = manager.validateProfile(options.validate);
        if (isValid) {
          logger.success('Profile is valid');
        } else {
          logger.fail('Profile is invalid');
          process.exit(1);
        }
      } else {
        cmd.help();
      }
    });

  return cmd;
}
