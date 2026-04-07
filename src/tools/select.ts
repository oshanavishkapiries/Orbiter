import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const selectTool: ToolDefinition = {
  name: 'select_dropdown',
  description: 'Select an option from a dropdown menu.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of the select element',
      },
      value: {
        type: 'string',
        description:
          'Value to select (can be value attribute, label, or index)',
      },
      by: {
        type: 'string',
        description: 'How to select: value, label, or index',
        enum: ['value', 'label', 'index'],
      },
    },
    required: ['selector', 'value'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, value, by = 'value' } = params;

      const page = context.getBrowserManager().getPage();

      await page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000,
      });

      if (by === 'value') {
        await page.selectOption(selector, { value });
      } else if (by === 'label') {
        await page.selectOption(selector, { label: value });
      } else if (by === 'index') {
        await page.selectOption(selector, { index: parseInt(value) });
      }

      return {
        success: true,
        message: `Selected "${value}" from ${selector}`,
      };
    } catch (error) {
      logger.error(`Select tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
