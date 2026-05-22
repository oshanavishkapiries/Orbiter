import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const snapshotTool: ToolDefinition = {
  name: 'snapshot',
  description:
    'Capture the current page accessibility tree. Call this whenever you need to understand what ' +
    'elements are on the page — after a click changes the UI, when a dialog opens, or when you ' +
    'are unsure what is visible. The snapshot shows each element\'s role, accessible name, labels, ' +
    'and placeholders. Use these values directly as parameters for click, fill, type, hover, and ' +
    'select_dropdown.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const page = context.getBrowserManager().getPage();
      const url = page.url();
      const title = await page.title().catch(() => '');

      let snapshot = '';
      try {
        snapshot = await (page as any).ariaSnapshot();
      } catch {
        snapshot = '(accessibility tree unavailable)';
      }

      logger.success(`Snapshot captured — ${url}`);

      return {
        success: true,
        message: `Snapshot of "${title || url}"`,
        data: { url, title, snapshot },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
