import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';
import { scanPage, injectHighlights, formatForLLM } from '../browser/page-intelligence.js';

export const analyzePageTool: ToolDefinition = {
  name: 'analyze_page',
  description:
    'Scan the current page and return a structured list of all interactive elements: inputs, buttons, links, dropdowns, forms, and their exact CSS selectors. ' +
    'Also returns the accessibility tree for semantic context. ' +
    'Call this AUTOMATICALLY after every navigate or whenever you need to know what is on the page before interacting. ' +
    'In headed (non-headless) mode, this also highlights elements with colored borders in the browser.',
  parameters: {
    type: 'object',
    properties: {
      highlight: {
        type: 'boolean',
        description:
          'Inject visual highlights (colored borders) into the page. Only visible when browser is not headless. Default: true.',
      },
    },
    required: [],
  },

  execute: async (
    params: { highlight?: boolean },
    context: ExecutionContext,
  ): Promise<ToolResult> => {
    const { highlight = true } = params;

    try {
      const page = context.getBrowserManager().getPage();

      logger.bullet('Scanning page for interactive elements...');
      const intel = await scanPage(page);

      if (highlight) {
        await injectHighlights(page, intel);
      }

      const payload = formatForLLM(intel);

      logger.success(
        `Page scanned: ${intel.inputs.length} inputs, ${intel.buttons.length} buttons, ${intel.links.length} links`,
      );

      return {
        success: true,
        message: intel.summary,
        data: payload,
      };
    } catch (error) {
      logger.error(`analyze_page failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
