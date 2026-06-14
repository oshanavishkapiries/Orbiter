import type { OrbiterConfig } from './schema.js';

export const defaults: OrbiterConfig = {
  version: 1,
  database: {
    url: '',
  },
  llm: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    openrouterApiKey: '',
    opencodeApiKey: '',
    maxTokens: 4096,
    temperature: 0.7,
    vision: 'auto',
  },
  browser: {
    headless: false,
    defaultTimeout: 30000,
    viewport: {
      width: 1280,
      height: 720,
    },
    profilePath: null,
    executablePath: null,
    channel: null,
  },
  execution: {
    maxRetries: 3,
    retryDelay: 1000,
    screenshotOnError: true,
    screenshotOnStep: false,
  },
  promptEnhancer: {
    enabled: false,
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
    includeScreenshots: false,
  },
  logging: {
    level: 'info',
    console: {
      enabled: true,
      colorize: true,
    },
  },
};
