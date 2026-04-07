import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const extractTextTool: ToolDefinition = {
  name: 'extract_text',
  description: 'Extract text content from an element or multiple elements.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of element(s) to extract text from',
      },
      multiple: {
        type: 'boolean',
        description: 'Extract from all matching elements (default: false)',
      },
      attribute: {
        type: 'string',
        description: 'Extract attribute instead of text (e.g., "href", "src")',
      },
    },
    required: ['selector'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, multiple = false, attribute } = params;

      const page = context.getBrowserManager().getPage();

      if (multiple) {
        // Extract from all matching elements
        const elements = await page.$$(selector);
        const results: string[] = [];

        for (const el of elements) {
          if (attribute) {
            const value = await el.getAttribute(attribute);
            if (value) results.push(value);
          } else {
            const text = await el.textContent();
            if (text) results.push(text.trim());
          }
        }

        return {
          success: true,
          message: `Extracted text from ${results.length} elements`,
          data: results,
        };
      } else {
        // Extract from single element
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        let value: string | null;
        if (attribute) {
          value = await element.getAttribute(attribute);
        } else {
          value = await element.textContent();
        }

        return {
          success: true,
          message: `Extracted ${attribute || 'text'} from ${selector}`,
          data: value?.trim() || '',
        };
      }
    } catch (error) {
      logger.error(`Extract text tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
