import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, specDescription, LOCATOR_PARAMS, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const fillTool: ToolDefinition = {
  name: 'fill',
  description:
    'Fill a form field with text. Faster than type — use for inputs and textareas. ' +
    'Identify the field using placeholder, label, or role+name from the snapshot. ' +
    'Set pressEnter:true to submit search boxes or single-field forms.',
  parameters: {
    type: 'object',
    properties: {
      ...LOCATOR_PARAMS,
      value: {
        type: 'string',
        description: 'The text to fill in',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Press Enter after filling (default: false)',
      },
    },
    required: ['value'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { value, pressEnter = false, ...spec } = params as LocatorSpec & {
        value: string;
        pressEnter?: boolean;
      };
      const page = context.getBrowserManager().getPage();
      const locator = resolveLocator(page, spec).first();

      await locator.fill(value, { timeout: 20000 });
      if (pressEnter) await locator.press('Enter');

      logger.success(`Filled ${specDescription(spec)}`);
      return {
        success: true,
        message: `Filled ${specDescription(spec)} with "${value}"${pressEnter ? ' and pressed Enter' : ''}`,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
