import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { defaults } from './defaults.js';
import { validateConfig } from './schema.js';
import type { Config } from './schema.js';

let configCache: Config | null = null;

export function loadConfig(): Config {
  if (configCache) {
    return configCache;
  }

  try {
    const configPath = resolve('config/default.yaml');
    const file = readFileSync(configPath, 'utf-8');
    const parsed = parse(file);
    const config = { ...defaults, ...parsed };
    validateConfig(config);
    configCache = config;
    return config;
  } catch {
    return defaults;
  }
}

export function getConfig(): Config {
  return loadConfig();
}
