import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';

export const recallStepHistoryTool: ToolDefinition = {
  name: 'recall_step_history',
  description:
    'Retrieve the execution history of previous steps from the session database. ' +
    'Use this when you need to review what actions were taken, what succeeded or failed, ' +
    'or when you need context about earlier steps that have scrolled out of your conversation window. ' +
    'Returns step summaries with tool names, params, and success status.',
  parameters: {
    type: 'object',
    properties: {
      from_step: {
        type: 'number',
        description: 'Starting step number (inclusive). Omit to start from step 1.',
      },
      to_step: {
        type: 'number',
        description: 'Ending step number (inclusive). Omit to get all steps up to now.',
      },
    },
    required: [],
  },
  execute: async (params: { from_step?: number; to_step?: number }, context: ExecutionContext): Promise<ToolResult> => {
    const repo = context.getSessionRepo();
    const sessionId = context.getSessionId();

    if (!repo || !sessionId) {
      return {
        success: false,
        error: 'Session memory not available. Database may not be connected.',
      };
    }

    const steps = await repo.getStepHistory(sessionId, params.from_step, params.to_step);

    if (steps.length === 0) {
      return {
        success: true,
        message: 'No steps recorded in this range.',
        data: [],
      };
    }

    const formatted = steps.map((s) => ({
      step: s.stepNumber,
      tool: s.toolName,
      success: s.success,
      summary: s.resultSummary,
      duration_ms: s.duration,
    }));

    const lines = formatted.map(
      (s) =>
        `Step ${s.step}: [${s.success ? 'OK' : 'FAIL'}] ${s.tool} — ${s.summary}`,
    );

    return {
      success: true,
      message: `Step history (${steps.length} steps):\n${lines.join('\n')}`,
      data: formatted,
    };
  },
};
