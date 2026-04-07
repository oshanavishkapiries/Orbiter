import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const scrollTool: ToolDefinition = {
  name: 'scroll',
  description: 'Scroll the page or an element.',
  parameters: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        description: 'Scroll direction',
        enum: ['up', 'down', 'top', 'bottom'],
      },
      amount: {
        type: 'number',
        description: 'Amount to scroll in pixels (for up/down)',
      },
      selector: {
        type: 'string',
        description:
          'CSS selector of element to scroll (optional, scrolls page if not provided)',
      },
    },
    required: ['direction'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { direction, amount = 500, selector } = params;

      const pageUtils = context.getPageUtils();

      if (selector) {
        await pageUtils.scrollToElement(selector);
      } else {
        await pageUtils.scroll(direction, amount);
      }

      // Wait for content to load after scroll
      await new Promise((r) => setTimeout(r, 1000));

      return {
        success: true,
        message: `Scrolled ${direction}${amount ? ` by ${amount}px` : ''}`,
      };
    } catch (error) {
      logger.error(`Scroll tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
