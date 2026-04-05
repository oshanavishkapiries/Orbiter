import type { Config } from './schema.js';

export const defaults: Config = {
  browser: {
    headless: true,
    timeout: 30000,
  },
  recorder: {
    screenshotOnError: true,
    videoRecording: false,
  },
  output: {
    format: 'json',
    includeMetadata: true,
  },
  logging: {
    level: 'info',
    file: 'logs/orbiter.log',
  },
};
