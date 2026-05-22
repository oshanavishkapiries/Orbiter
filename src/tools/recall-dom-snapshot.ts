import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';

export const recallDomSnapshotTool: ToolDefinition = {
  name: 'recall_dom_snapshot',
  description:
    'Retrieve the full DOM analysis and interactive element list from a previous step. ' +
    'Use this when you need to see the actual CSS selectors, inputs, buttons, or links ' +
    'from a page that was analyzed earlier, without re-navigating or re-running analyze_page. ' +
    'Omit step_number to get the most recent DOM snapshot.',
  parameters: {
    type: 'object',
    properties: {
      step_number: {
        type: 'number',
        description:
          'The step number whose DOM snapshot you want. Omit for the latest snapshot.',
      },
    },
    required: [],
  },
  execute: async (params: { step_number?: number }, context: ExecutionContext): Promise<ToolResult> => {
    const repo = context.getSessionRepo();
    const sessionId = context.getSessionId();

    if (!repo || !sessionId) {
      return {
        success: false,
        error: 'Session memory not available. Database may not be connected.',
      };
    }

    const snapshot = await repo.getDomSnapshot(sessionId, params.step_number);

    if (!snapshot) {
      const which = params.step_number ? `step ${params.step_number}` : 'any step';
      return {
        success: false,
        error: `No DOM snapshot found for ${which}. Run navigate or analyze_page first.`,
      };
    }

    return {
      success: true,
      message: `DOM snapshot from step ${snapshot.stepNumber} — ${snapshot.url}`,
      data: {
        step: snapshot.stepNumber,
        url: snapshot.url,
        title: snapshot.title,
        interactiveElements: snapshot.interactiveElements,
        fullAnalysis: snapshot.fullAnalysis,
      },
    };
  },
};
