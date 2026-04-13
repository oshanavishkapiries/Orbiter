import { z } from 'zod';

export const configSchema = z.object({
  version: z.number().default(1),

  database: z.object({
    url: z.string().default('postgresql://root:root@45.159.221.130:7777/root'),
  }),

  llm: z.object({
    provider: z
      .enum(['openrouter', 'openai', 'anthropic'])
      .default('openrouter'),
    model: z.string().default('anthropic/claude-sonnet-4'),
    maxTokens: z.number().default(4096),
    temperature: z.number().min(0).max(2).default(0.7),
  }),

  browser: z.object({
    headless: z.boolean().default(false),
    defaultTimeout: z.number().default(30000),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }),
    profilePath: z.string().nullable().default(null),
    stealth: z.boolean().default(true),
  }),

  execution: z.object({
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    screenshotOnError: z.boolean().default(true),
    screenshotOnStep: z.boolean().default(false),
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
    outputDir: z.string().default('./flows'),
    includeScreenshots: z.boolean().default(false),
  }),

  output: z.object({
    dir: z.string().default('./output'),
    formats: z.array(z.enum(['json', 'csv'])).default(['json']),
  }),

  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    file: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./logs'),
      maxSize: z.string().default('10mb'),
      maxFiles: z.number().default(10),
    }),
    console: z.object({
      enabled: z.boolean().default(true),
      colorize: z.boolean().default(true),
    }),
  }),
});

export type OrbiterConfig = z.infer<typeof configSchema>;
