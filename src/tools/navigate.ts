import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const navigateTool: ToolDefinition = {
  name: 'navigate',
  description: 'Navigate to a URL. Use this to go to websites.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          'The URL to navigate to (must include http:// or https://)',
      },
      waitUntil: {
        type: 'string',
        description: 'When to consider navigation complete',
        enum: ['load', 'domcontentloaded', 'networkidle'],
      },
    },
    required: ['url'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { url, waitUntil = 'networkidle' } = params;

      const browser = context.getBrowserManager();

      await browser.navigate(url, { waitUntil });

      const title = await browser.getTitle();

      return {
        success: true,
        message: `Navigated to ${url}`,
        data: {
          url: browser.getUrl(),
          title,
        },
      };
    } catch (error) {
      logger.error(`Navigate tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
