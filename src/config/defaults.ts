import type { OrbiterConfig } from './schema.js';

export const defaults: OrbiterConfig = {
  version: 1,
  database: {
    url: 'postgresql://root:root@45.159.221.130:7777/root',
  },
  llm: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  browser: {
    headless: false,
    defaultTimeout: 30000,
    viewport: {
      width: 1280,
      height: 720,
    },
    profilePath: null,
    stealth: true,
  },
  execution: {
    maxRetries: 3,
    retryDelay: 1000,
    screenshotOnError: true,
    screenshotOnStep: false,
  },
  loop: {
    defaultDelay: {
      min: 800,
      max: 1500,
    },
    maxItems: 100,
    scrollPauseTime: 1000,
  },
  recording: {
    enabled: true,
    outputDir: './flows',
    includeScreenshots: false,
  },
  output: {
    dir: './output',
    formats: ['json'],
  },
  logging: {
    level: 'info',
    file: {
      enabled: true,
      path: './logs',
      maxSize: '10mb',
      maxFiles: 10,
    },
    console: {
      enabled: true,
      colorize: true,
    },
  },
};
