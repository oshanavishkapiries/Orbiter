import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const evaluateTool: ToolDefinition = {
  name: 'evaluate_js',
  description:
    'Execute JavaScript code in the browser context. Use with caution.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute',
      },
    },
    required: ['code'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { code } = params;

      const browser = context.getBrowserManager();
      const result = await browser.evaluate(code);

      return {
        success: true,
        message: 'JavaScript executed successfully',
        data: result,
      };
    } catch (error) {
      logger.error(`Evaluate tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
