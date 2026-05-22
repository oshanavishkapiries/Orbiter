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
      pressEnter: {
        type: 'boolean',
        description:
          'Press Enter after typing. Preferred for search boxes and forms — more reliable than clicking submit buttons.',
      },
    },
    required: ['selector', 'text'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, text, clear = true, delay = 50, pressEnter = false } = params;

      const page = context.getBrowserManager().getPage();
      const locator = page.locator(selector).first();

      // locator auto-waits for attached + visible + enabled — more resilient
      // on SPAs that rehydrate the DOM after initial load.
      if (clear) {
        await locator.fill('', { timeout: 20000 });
      }

      await locator.pressSequentially(text, { delay });

      if (pressEnter) {
        await page.press(selector, 'Enter');
      }

      return {
        success: true,
        message: `Typed "${text}" into ${selector}${pressEnter ? ' and pressed Enter' : ''}`,
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
