import fs from 'fs';
import path from 'path';
import { logger } from '../cli/ui/logger.js';
import { PATHS } from '../utils/paths.js';
import { ensureDir } from '../utils/fs.js';

export interface OrbiterProfile {
  name: string;
  path: string;
  createdAt: number;
  lastUsedAt?: number;
  description?: string;
}

const PROFILES_DIR = path.join(PATHS.data, 'profiles');
const META_FILE = 'orbiter-profile.json';

export class ProfileManager {
  /**
   * List all Orbiter-managed browser profiles
   */
  listProfiles(): OrbiterProfile[] {
    ensureDir(PROFILES_DIR);

    const profiles: OrbiterProfile[] = [];

    // Always include the built-in default profile
    profiles.push(this.getDefaultProfileInfo());

    try {
      const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const profilePath = path.join(PROFILES_DIR, entry.name);
        const meta = this.readMeta(profilePath);
        if (meta) profiles.push(meta);
      }
    } catch (err) {
      logger.debug(`Error reading profiles dir: ${(err as Error).message}`);
    }

    return profiles;
  }

  /**
   * Create a new named profile
   */
  createProfile(name: string, description?: string): OrbiterProfile {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const profilePath = path.join(PROFILES_DIR, safeName);

    if (fs.existsSync(profilePath)) {
      throw new Error(`Profile "${safeName}" already exists at ${profilePath}`);
    }

    ensureDir(profilePath);

    const meta: OrbiterProfile = {
      name: safeName,
      path: profilePath,
      createdAt: Date.now(),
      description,
    };

    this.writeMeta(profilePath, meta);
    logger.success(`Profile "${safeName}" created at ${profilePath}`);
    return meta;
  }

  /**
   * Resolve a profile name or path to an absolute directory path.
   * Accepts:
   *   - "default"           → data/browser-profile (built-in)
   *   - "work"              → data/profiles/work
   *   - absolute/relative path → used as-is
   */
  resolvePath(nameOrPath: string): string {
    if (!nameOrPath || nameOrPath === 'default') {
      return PATHS.browserProfile;
    }

    // Absolute or relative path with separators → use directly
    if (nameOrPath.includes('/') || nameOrPath.includes('\\')) {
      return path.resolve(nameOrPath);
    }

    // Named profile
    const profilePath = path.join(PROFILES_DIR, nameOrPath);
    if (!fs.existsSync(profilePath)) {
      logger.warn(
        `Profile "${nameOrPath}" not found — creating it automatically at ${profilePath}`,
      );
      this.createProfile(nameOrPath);
    }

    return profilePath;
  }

  /**
   * Mark a profile as just used (updates lastUsedAt in metadata)
   */
  touchProfile(profilePath: string): void {
    try {
      const meta = this.readMeta(profilePath);
      if (meta) {
        meta.lastUsedAt = Date.now();
        this.writeMeta(profilePath, meta);
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Check whether a profile directory contains saved browser state
   * (i.e. the user has logged into something using it before)
   */
  hasSavedState(profilePath: string): boolean {
    // Playwright persistent context creates these marker files/dirs
    return (
      fs.existsSync(path.join(profilePath, 'Default')) ||
      fs.existsSync(path.join(profilePath, 'Cookies'))
    );
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private getDefaultProfileInfo(): OrbiterProfile {
    const hasSaved = this.hasSavedState(PATHS.browserProfile);
    return {
      name: 'default',
      path: PATHS.browserProfile,
      createdAt: 0,
      description: hasSaved
        ? 'Default profile (has saved login sessions)'
        : 'Default profile (no saved state yet)',
    };
  }

  private readMeta(profilePath: string): OrbiterProfile | null {
    const metaPath = path.join(profilePath, META_FILE);
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as OrbiterProfile;
    } catch {
      return null;
    }
  }

  private writeMeta(profilePath: string, meta: OrbiterProfile): void {
    const metaPath = path.join(profilePath, META_FILE);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
}
