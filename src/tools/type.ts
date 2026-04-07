import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const typeTool: ToolDefinition = {
  name: 'type',
  description: 'Type text into an input field or textarea.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the input element',
      },
      text: {
        type: 'string',
        description: 'Text to type',
      },
      clear: {
        type: 'boolean',
        description: 'Clear existing text before typing (default: true)',
      },
      delay: {
        type: 'number',
        description:
          'Delay between key presses in ms (makes typing human-like)',
      },
    },
    required: ['selector', 'text'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, text, clear = true, delay = 50 } = params;

      const page = context.getBrowserManager().getPage();

      // Wait for input to be visible
      await page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000,
      });

      // Clear existing text if needed
      if (clear) {
        await page.fill(selector, '');
      }

      // Type with delay
      await page.type(selector, text, { delay });

      return {
        success: true,
        message: `Typed "${text}" into ${selector}`,
      };
    } catch (error) {
      logger.error(`Type tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
