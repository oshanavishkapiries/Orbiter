import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const waitTool: ToolDefinition = {
  name: 'wait',
  description: 'Wait for a condition to be met or for a specified time.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of wait',
        enum: ['selector', 'time', 'networkidle'],
      },
      selector: {
        type: 'string',
        description: 'CSS selector to wait for (required if type=selector)',
      },
      duration: {
        type: 'number',
        description: 'Time to wait in milliseconds (required if type=time)',
      },
      timeout: {
        type: 'number',
        description: 'Maximum time to wait in milliseconds',
      },
    },
    required: ['type'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { type, selector, duration = 1000, timeout = 30000 } = params;

      const browser = context.getBrowserManager();
      const page = browser.getPage();

      if (type === 'selector') {
        if (!selector) {
          throw new Error('Selector is required for type=selector');
        }
        await page.waitForSelector(selector, { timeout });
        return {
          success: true,
          message: `Selector ${selector} appeared`,
        };
      } else if (type === 'time') {
        await page.waitForTimeout(duration);
        return {
          success: true,
          message: `Waited for ${duration}ms`,
        };
      } else if (type === 'networkidle') {
        await page.waitForLoadState('networkidle', { timeout });
        return {
          success: true,
          message: 'Network is idle',
        };
      }

      throw new Error(`Unknown wait type: ${type}`);
    } catch (error) {
      logger.error(`Wait tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
