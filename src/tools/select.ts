import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, specDescription, LOCATOR_PARAMS, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const selectTool: ToolDefinition = {
  name: 'select_dropdown',
  description:
    'Select an option from a native <select> dropdown. For custom dropdowns (e.g. a div/button ' +
    'that opens a list), use click to open then click to choose the option.',
  parameters: {
    type: 'object',
    properties: {
      ...LOCATOR_PARAMS,
      value: {
        type: 'string',
        description: 'The option to select',
      },
      by: {
        type: 'string',
        description: 'Match by "label" (visible text, default), "value" (option value attr), or "index"',
        enum: ['label', 'value', 'index'],
      },
    },
    required: ['value'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { value, by = 'label', ...spec } = params as LocatorSpec & {
        value: string;
        by?: 'label' | 'value' | 'index';
      };
      const page = context.getBrowserManager().getPage();
      const locator = resolveLocator(page, spec).first();

      await locator.waitFor({ state: 'visible', timeout: 10000 });

      if (by === 'value')       await locator.selectOption({ value });
      else if (by === 'index')  await locator.selectOption({ index: parseInt(value) });
      else                      await locator.selectOption({ label: value });

      logger.success(`Selected "${value}" in ${specDescription(spec)}`);
      return { success: true, message: `Selected "${value}" in ${specDescription(spec)}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
