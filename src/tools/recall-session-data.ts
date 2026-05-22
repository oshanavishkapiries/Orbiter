import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';

export const recallSessionDataTool: ToolDefinition = {
  name: 'recall_session_data',
  description:
    'Retrieve all structured data saved during this session (from save_extracted_data calls). ' +
    'Use this when you need to review, verify, or continue working with data that was collected in earlier steps. ' +
    'Returns all collected records grouped by the step they were extracted in.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_params: Record<string, never>, context: ExecutionContext): Promise<ToolResult> => {
    const repo = context.getSessionRepo();
    const sessionId = context.getSessionId();

    if (!repo || !sessionId) {
      return {
        success: false,
        error: 'Session memory not available. Database may not be connected.',
      };
    }

    const records = await repo.getAllCollectedData(sessionId);

    if (records.length === 0) {
      return {
        success: true,
        message: 'No data has been extracted in this session yet.',
        data: [],
      };
    }

    const totalItems = records.reduce((sum, r) => {
      const d = r.data;
      return sum + (Array.isArray(d) ? d.length : 1);
    }, 0);

    return {
      success: true,
      message: `Found ${records.length} extraction(s) totalling ${totalItems} item(s).`,
      data: records.map((r) => ({
        step: r.stepNumber,
        tool: r.toolName,
        data: r.data,
      })),
    };
  },
};
