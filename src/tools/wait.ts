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
        description: 'Type of wait: "selector" waits for a CSS selector to appear, "time" waits a fixed duration, "load" waits for the page load event to fire.',
        enum: ['selector', 'time', 'load'],
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
      } else if (type === 'load') {
        await page.waitForLoadState('load', { timeout });
        return {
          success: true,
          message: 'Page load event fired',
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
