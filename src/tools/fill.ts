import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const fillTool: ToolDefinition = {
  name: 'fill',
  description:
    'Fill a form field with text (faster than type, no delay between characters). ' +
    'Use pressEnter:true to submit search boxes or forms by pressing Enter — this is more reliable than clicking a submit button.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the input element',
      },
      value: {
        type: 'string',
        description: 'Value to fill',
      },
      pressEnter: {
        type: 'boolean',
        description:
          'Press Enter after filling. Preferred for search boxes and forms — avoids autocomplete/button-visibility issues.',
      },
    },
    required: ['selector', 'value'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, value, pressEnter = false } = params;

      const page = context.getBrowserManager().getPage();

      await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      await page.fill(selector, value);

      if (pressEnter) {
        await page.press(selector, 'Enter');
      }

      return {
        success: true,
        message: `Filled ${selector} with "${value}"${pressEnter ? ' and pressed Enter' : ''}`,
      };
    } catch (error) {
      logger.error(`Fill tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
