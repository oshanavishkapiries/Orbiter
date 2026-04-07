import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const extractDataTool: ToolDefinition = {
  name: 'extract_data',
  description:
    'Extract structured data from page using a schema (multiple fields from elements).',
  parameters: {
    type: 'object',
    properties: {
      schema: {
        type: 'object',
        description: 'Object mapping field names to CSS selectors',
      },
      containerSelector: {
        type: 'string',
        description:
          'CSS selector for container (extract from all matching containers)',
      },
    },
    required: ['schema'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { schema, containerSelector } = params;

      const page = context.getBrowserManager().getPage();

      if (containerSelector) {
        // Extract from multiple containers
        const containers = await page.$$(containerSelector);
        const results: any[] = [];

        for (const container of containers) {
          const item: any = {};

          for (const [field, selector] of Object.entries(schema)) {
            const element = await container.$(selector as string);
            if (element) {
              const text = await element.textContent();
              item[field] = text?.trim() || '';
            } else {
              item[field] = null;
            }
          }

          results.push(item);
        }

        return {
          success: true,
          message: `Extracted data from ${results.length} items`,
          data: results,
        };
      } else {
        // Extract from single page
        const result: any = {};

        for (const [field, selector] of Object.entries(schema)) {
          const element = await page.$(selector as string);
          if (element) {
            const text = await element.textContent();
            result[field] = text?.trim() || '';
          } else {
            result[field] = null;
          }
        }

        return {
          success: true,
          message: 'Extracted data from page',
          data: result,
        };
      }
    } catch (error) {
      logger.error(`Extract data tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
