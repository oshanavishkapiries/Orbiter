import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';

export const recallDomSnapshotTool: ToolDefinition = {
  name: 'recall_dom_snapshot',
  description:
    'Retrieve the accessibility snapshot saved from a previous navigate or snapshot call. ' +
    'Useful when history has been trimmed and you need to re-examine the page structure ' +
    'without navigating again. Omit step_number to get the most recent snapshot.',
  parameters: {
    type: 'object',
    properties: {
      step_number: {
        type: 'number',
        description: 'The step number to retrieve. Omit for the latest.',
      },
    },
    required: [],
  },
  execute: async (
    params: { step_number?: number },
    context: ExecutionContext,
  ): Promise<ToolResult> => {
    const repo = context.getSessionRepo();
    const sessionId = context.getSessionId();

    if (!repo || !sessionId) {
      return { success: false, error: 'Session memory not available.' };
    }

    const snap = await repo.getDomSnapshot(sessionId, params.step_number);
    if (!snap) {
      return {
        success: false,
        error: `No snapshot found. Run navigate or snapshot first.`,
      };
    }

    const content =
      snap.fullAnalysis ?? snap.interactiveElements ?? '(no content)';
    const contentStr =
      typeof content === 'string' ? content : JSON.stringify(content);

    return {
      success: true,
      message: `Snapshot from step ${snap.stepNumber} — ${snap.url}\n\n${contentStr}`,
      data: { step: snap.stepNumber, url: snap.url, title: snap.title },
    };
  },
};
