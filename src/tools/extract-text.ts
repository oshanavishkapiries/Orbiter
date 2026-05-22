import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const extractTextTool: ToolDefinition = {
  name: 'extract_text',
  description: 'Extract text content or an attribute from one or all matching elements.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of element(s) to extract from',
      },
      multiple: {
        type: 'boolean',
        description: 'Extract from all matching elements (default: false)',
      },
      attribute: {
        type: 'string',
        description: 'Extract attribute instead of text content (e.g., "href", "src")',
      },
    },
    required: ['selector'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, multiple = false, attribute } = params;
      const mcpClient = context.getMcpClient();

      if (multiple) {
        const expression = attribute
          ? `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(el => el.getAttribute(${JSON.stringify(attribute)})).filter(Boolean)`
          : `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(el => (el.textContent || '').trim()).filter(Boolean)`;

        const results = await mcpClient.evaluate(expression);

        return {
          success: true,
          message: `Extracted ${Array.isArray(results) ? results.length : 0} values`,
          data: results,
        };
      } else {
        const expression = attribute
          ? `document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(attribute)}) ?? null`
          : `(document.querySelector(${JSON.stringify(selector)})?.textContent || '').trim() || null`;

        const value = await mcpClient.evaluate(expression);

        if (value === null || value === undefined) {
          return { success: false, error: `Element not found: ${selector}` };
        }

        return {
          success: true,
          message: `Extracted ${attribute || 'text'} from ${selector}`,
          data: value,
        };
      }
    } catch (error) {
      logger.error(`Extract text tool error: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  },
};
