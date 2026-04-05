import { z } from 'zod';

export const BrowserConfig = z.object({
  headless: z.boolean().optional(),
  timeout: z.number().optional(),
});

export const RecorderConfig = z.object({
  screenshotOnError: z.boolean().optional(),
  videoRecording: z.boolean().optional(),
});

export const OutputConfig = z.object({
  format: z.enum(['json', 'yaml']).optional(),
  includeMetadata: z.boolean().optional(),
});

export const LoggingConfig = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  file: z.string().optional(),
});

export const ConfigSchema = z.object({
  browser: BrowserConfig.optional(),
  recorder: RecorderConfig.optional(),
  output: OutputConfig.optional(),
  logging: LoggingConfig.optional(),
}).default({});

export type Config = z.infer<typeof ConfigSchema>;

export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config);
}
