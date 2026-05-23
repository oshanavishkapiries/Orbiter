import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { OutputFormatter } from '../recorder/output-formatter.js';

export const saveJsonTool: ToolDefinition = {
  name: 'save_json',
  description:
    'Save data as JSON to the database. ' +
    'Pass "data" directly or "storageKey" to read from browser localStorage. ' +
    'Returns the saved output reference.',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      data: {
        type: 'array',
        description: 'Array of records or any JSON-serialisable value to save directly.',
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
      data?: any;
      storageKey?: string;
      filename?: string;
    };

    let payload: any;

    if (storageKey) {
      const mcpClient = context.getMcpClient();
      const key = JSON.stringify(storageKey);
      const raw = await mcpClient.evaluate(
        `JSON.stringify(JSON.parse(localStorage.getItem(${key}) || 'null'))`,
      );
      await mcpClient.evaluate(`localStorage.removeItem(${key})`).catch(() => {});
      try {
        payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return { success: false, error: `Failed to parse localStorage data for key "${storageKey}"` };
      }
    } else if (data !== undefined && data !== null) {
      payload = data;
    } else {
      return { success: false, error: 'Provide "data" or "storageKey" (localStorage key).' };
    }

    const records = Array.isArray(payload) ? payload : [payload];

    if (records.length === 0) {
      return { success: false, error: 'No data to save.' };
    }

    const formatter = new OutputFormatter();
    const name = filename || `data-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
    const ref = await formatter.saveJson(records, name, context.getSessionId());

    return {
      success: true,
      message: `Saved ${records.length} record(s) to database (${ref})`,
      data: { outputRef: ref, count: records.length },
    };
  },
};
