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
        const containers = await page.locator(containerSelector).all();
        const results: any[] = [];

        for (const container of containers) {
          const item: any = {};

          for (const [field, selector] of Object.entries(schema)) {
            const locator = container.locator(selector as string).first();
            const count = await locator.count();
            if (count > 0) {
              const text = await locator.textContent();
              item[field] = text?.trim() || '';
            } else {
              item[field] = null;
            }
          }

          results.push(item);
        }

        // Warn if all values across all items are null
        const allNull =
          results.length > 0 &&
          results.every((item) => Object.values(item).every((v) => v === null));
        if (allNull) {
          return {
            success: false,
            error: `No data extracted — all selectors returned null. Verify the schema selectors match the page structure.`,
          };
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
          const locator = page.locator(selector as string).first();
          const count = await locator.count();
          if (count > 0) {
            const text = await locator.textContent();
            result[field] = text?.trim() || '';
          } else {
            result[field] = null;
          }
        }

        // Warn if all values are null
        const allNull = Object.values(result).every((v) => v === null);
        if (allNull) {
          return {
            success: false,
            error: `No data extracted — all selectors returned null. Verify the schema selectors match the page structure.`,
          };
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
