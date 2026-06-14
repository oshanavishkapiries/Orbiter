import { z } from 'zod';

export const configSchema = z.object({
  version: z.number().default(1),

  database: z.object({
    url: z.string().default(''),
  }),

  llm: z.object({
    provider: z
      .enum(['openrouter', 'opencode-go', 'openai', 'anthropic'])
      .default('openrouter'),
    model: z.string().default('anthropic/claude-sonnet-4'),
    maxTokens: z.number().default(4096),
    temperature: z.number().min(0).max(2).default(0.7),
    vision: z.enum(['auto', 'enabled', 'disabled']).default('auto'),
  }),

  browser: z.object({
    headless: z.boolean().default(false),
    defaultTimeout: z.number().default(30000),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }),
    profilePath: z.string().nullable().default(null),
    executablePath: z.string().nullable().default(null),
    channel: z
      .enum(['chrome', 'msedge', 'firefox', 'webkit'])
      .nullable()
      .default(null),
  }),

  execution: z.object({
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    screenshotOnError: z.boolean().default(true),
    screenshotOnStep: z.boolean().default(false),
  }),

  promptEnhancer: z.object({
    enabled: z.boolean().default(false),
  }),

  loop: z.object({
    defaultDelay: z.object({
      min: z.number().default(800),
      max: z.number().default(1500),
    }),
    maxItems: z.number().default(100),
    scrollPauseTime: z.number().default(1000),
  }),

  recording: z.object({
    enabled: z.boolean().default(true),
    includeScreenshots: z.boolean().default(false),
  }),

  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    console: z.object({
      enabled: z.boolean().default(true),
      colorize: z.boolean().default(true),
    }),
  }),
});

export type OrbiterConfig = z.infer<typeof configSchema>;
