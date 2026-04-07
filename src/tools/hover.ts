import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const hoverTool: ToolDefinition = {
  name: 'hover',
  description: 'Hover over an element (useful for revealing dropdown menus).',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of element to hover over',
      },
      waitAfter: {
        type: 'number',
        description: 'Milliseconds to wait after hovering',
      },
    },
    required: ['selector'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, waitAfter = 500 } = params;

      const page = context.getBrowserManager().getPage();

      await page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000,
      });
      await page.hover(selector);

      if (waitAfter > 0) {
        await page.waitForTimeout(waitAfter);
      }

      return {
        success: true,
        message: `Hovered over ${selector}`,
      };
    } catch (error) {
      logger.error(`Hover tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
