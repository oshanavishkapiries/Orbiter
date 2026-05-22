import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const extractDataTool: ToolDefinition = {
  name: 'extract_data',
  description:
    'Extract structured data from page using a schema (multiple fields from elements). Use CSS selectors to target elements.',
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
          'CSS selector for container — extract from all matching containers and return an array',
      },
    },
    required: ['schema'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { schema, containerSelector } = params;
      const mcpClient = context.getMcpClient();

      if (containerSelector) {
        const expression = `
          (() => {
            const containers = Array.from(document.querySelectorAll(${JSON.stringify(containerSelector)}));
            const schema = ${JSON.stringify(schema)};
            return containers.map(container => {
              const item = {};
              for (const [field, selector] of Object.entries(schema)) {
                const el = container.querySelector(selector);
                item[field] = el ? (el.textContent || '').trim() || null : null;
              }
              return item;
            });
          })()
        `;

        const results = await mcpClient.evaluate(expression);

        if (!Array.isArray(results) || results.length === 0) {
          return { success: false, error: 'No containers matched the containerSelector.' };
        }

        const allNull = results.every((item: any) =>
          Object.values(item).every((v) => v === null),
        );
        if (allNull) {
          return {
            success: false,
            error: 'No data extracted — all selectors returned null. Verify the schema selectors match the page structure.',
          };
        }

        return {
          success: true,
          message: `Extracted data from ${results.length} items`,
          data: results,
        };
      } else {
        const expression = `
          (() => {
            const schema = ${JSON.stringify(schema)};
            const result = {};
            for (const [field, selector] of Object.entries(schema)) {
              const el = document.querySelector(selector);
              result[field] = el ? (el.textContent || '').trim() || null : null;
            }
            return result;
          })()
        `;

        const result = await mcpClient.evaluate(expression);

        const allNull = Object.values(result as Record<string, any>).every((v) => v === null);
        if (allNull) {
          return {
            success: false,
            error: 'No data extracted — all selectors returned null. Verify the schema selectors match the page structure.',
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
      return { success: false, error: (error as Error).message };
    }
  },
};
