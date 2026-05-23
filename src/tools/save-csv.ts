import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { OutputFormatter } from '../recorder/output-formatter.js';

export const saveCsvTool: ToolDefinition = {
  name: 'save_csv',
  description:
    'Save data as CSV to the database. ' +
    'Pass "data" directly (small sets) or "storageKey" to read from browser localStorage (bulk sets accumulated page-by-page). ' +
    'Returns the saved output reference.',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      data: {
        type: 'array',
        description: 'Array of plain objects to save. Columns inferred from object keys.',
      },
      storageKey: {
        type: 'string',
        description:
          'Browser localStorage key to read data from. Use when you accumulated data in localStorage across pages. ' +
          'The tool reads and clears the key automatically.',
      },
      filename: {
        type: 'string',
        description: 'Base name for this output. Auto-generated if omitted.',
      },
    },
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { data, storageKey, filename } = params as {
      data?: any[];
      storageKey?: string;
      filename?: string;
    };

    let records: any[];

    if (storageKey) {
      const mcpClient = context.getMcpClient();
      const key = JSON.stringify(storageKey);
      const raw = await mcpClient.evaluate(
        `JSON.stringify(JSON.parse(localStorage.getItem(${key}) || '[]'))`,
      );
      await mcpClient.evaluate(`localStorage.removeItem(${key})`).catch(() => {});
      try {
        records = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
      } catch {
        return { success: false, error: `Failed to parse localStorage data for key "${storageKey}"` };
      }
    } else if (Array.isArray(data)) {
      records = data;
    } else {
      return { success: false, error: 'Provide "data" (array) or "storageKey" (localStorage key).' };
    }

    if (records.length === 0) {
      return { success: false, error: 'No records to save.' };
    }

    const formatter = new OutputFormatter();
    const name = filename || `data-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
    const ref = await formatter.saveCsv(records, name, context.getSessionId());

    if (!ref) {
      return { success: false, error: 'CSV save failed.' };
    }

    return {
      success: true,
      message: `Saved ${records.length} records to database (${ref})`,
      data: { outputRef: ref, count: records.length },
    };
  },
};
