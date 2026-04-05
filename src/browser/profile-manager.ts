import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../cli/ui/logger.js';
import { BrowserProfile } from './types.js';

export class ProfileManager {
  /**
   * List available Chrome/Chromium profiles
   */
  async listProfiles(): Promise<BrowserProfile[]> {
    const profiles: BrowserProfile[] = [];
    const basePath = this.getChromeBasePath();

    if (!basePath || !fs.existsSync(basePath)) {
      logger.warn('Chrome installation not found');
      return profiles;
    }

    try {
      // Read profile directories
      const items = fs.readdirSync(basePath);

      for (const item of items) {
        if (item.startsWith('Profile') || item === 'Default') {
          const profilePath = path.join(basePath, item);
          const prefsPath = path.join(profilePath, 'Preferences');

          if (fs.existsSync(prefsPath)) {
            const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));

            profiles.push({
              name: item,
              path: profilePath,
              userAgent: prefs.profile?.user_agent,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading profiles: ${(error as Error).message}`);
    }

    return profiles;
  }

  /**
   * Get profile by name
   */
  async getProfile(name: string): Promise<BrowserProfile | null> {
    const profiles = await this.listProfiles();
    return profiles.find((p) => p.name === name) || null;
  }

  /**
   * Get Chrome base path based on OS
   */
  private getChromeBasePath(): string | null {
    const platform = process.platform;
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      return path.join(
        homeDir,
        'Library',
        'Application Support',
        'Google',
        'Chrome',
      );
    } else if (platform === 'win32') {
      return path.join(
        homeDir,
        'AppData',
        'Local',
        'Google',
        'Chrome',
        'User Data',
      );
    } else if (platform === 'linux') {
      return path.join(homeDir, '.config', 'google-chrome');
    }

    return null;
  }

  /**
   * Validate profile path
   */
  validateProfile(profilePath: string): boolean {
    if (!fs.existsSync(profilePath)) {
      logger.error(`Profile path does not exist: ${profilePath}`);
      return false;
    }

    const prefsPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefsPath)) {
      logger.error(`Invalid profile: Preferences file not found`);
      return false;
    }

    return true;
  }

  /**
   * Display profile info
   */
  async displayProfiles(): Promise<void> {
    const profiles = await this.listProfiles();

    if (profiles.length === 0) {
      console.log('\nNo Chrome profiles found.\n');
      return;
    }

    console.log('\nAvailable Chrome Profiles:\n');

    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.name}`);
      console.log(`   Path: ${profile.path}`);
      console.log('');
    });
  }
}
