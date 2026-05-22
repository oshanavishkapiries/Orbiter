import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, specDescription, LOCATOR_PARAMS, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const typeTool: ToolDefinition = {
  name: 'type',
  description:
    'Type text character-by-character into a field — use when the site listens to keystrokes ' +
    '(autocomplete, live search, rich text editors). For plain inputs prefer fill which is faster.',
  parameters: {
    type: 'object',
    properties: {
      ...LOCATOR_PARAMS,
      text: {
        type: 'string',
        description: 'The text to type',
      },
      delay: {
        type: 'number',
        description: 'Delay between keystrokes in ms (default: 50)',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Press Enter after typing (default: false)',
      },
    },
    required: ['text'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { text, delay = 50, pressEnter = false, ...spec } = params as LocatorSpec & {
        text: string;
        delay?: number;
        pressEnter?: boolean;
      };
      const page = context.getBrowserManager().getPage();
      const locator = resolveLocator(page, spec).first();

      await locator.fill('', { timeout: 20000 });
      await locator.pressSequentially(text, { delay });
      if (pressEnter) await locator.press('Enter');

      logger.success(`Typed into ${specDescription(spec)}`);
      return {
        success: true,
        message: `Typed "${text}" into ${specDescription(spec)}${pressEnter ? ' and pressed Enter' : ''}`,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
