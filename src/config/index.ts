import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { configSchema, OrbiterConfig } from './schema.js';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: OrbiterConfig | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = this.findConfigPath();
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private findConfigPath(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'orbiter.yaml'),
      path.join(process.cwd(), 'orbiter.yml'),
      path.join(process.cwd(), 'config', 'default.yaml'),
      path.join(process.cwd(), '.orbiter', 'config.yaml'),
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // Return default path even if doesn't exist
    return possiblePaths[2];
  }

  load(): OrbiterConfig {
    if (this.config) {
      return this.config;
    }

    let rawConfig = {};

    if (fs.existsSync(this.configPath)) {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      rawConfig = yaml.parse(fileContent);
    }

    // Merge with environment variables
    const envConfig = this.loadEnvConfig();
    const mergedConfig = this.deepMerge(rawConfig, envConfig);

    // Validate and parse
    const result = configSchema.safeParse(mergedConfig);

    if (!result.success) {
      throw new Error(`Configuration validation failed: ${result.error.message}`);
    }

    this.config = result.data;
    return this.config;
  }

  private loadEnvConfig(): Partial<OrbiterConfig> {
    const env: Partial<OrbiterConfig> = {};

    if (process.env.DEFAULT_MODEL) {
      env.llm = { ...env.llm, model: process.env.DEFAULT_MODEL } as any;
    }

    if (process.env.BROWSER_HEADLESS) {
      env.browser = {
        ...env.browser,
        headless: process.env.BROWSER_HEADLESS === 'true',
      } as any;
    }

    if (process.env.CHROME_PROFILE_PATH) {
      env.browser = {
        ...env.browser,
        profilePath: process.env.CHROME_PROFILE_PATH,
      } as any;
    }

    if (process.env.LOG_LEVEL) {
      env.logging = {
        ...env.logging,
        level: process.env.LOG_LEVEL as any,
      } as any;
    }

    return env;
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  getConfig(): OrbiterConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }
}

export const config = () => ConfigLoader.getInstance().getConfig();