import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';
import { scanPage, injectHighlights, formatForLLM } from '../browser/page-intelligence.js';

export const navigateTool: ToolDefinition = {
  name: 'navigate',
  description:
    'Navigate to a URL. Automatically scans the page after loading and returns all interactive elements with their exact selectors. ' +
    'Use waitUntil="load" (default) for most sites. For SPAs like Google Maps, YouTube, or Twitter use "domcontentloaded" — they never reach networkidle.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          'The URL to navigate to (must include http:// or https://)',
      },
      waitUntil: {
        type: 'string',
        description:
          'When to consider navigation complete. "load" (default) works for most sites. ' +
          '"domcontentloaded" is faster and required for SPAs (Google Maps, YouTube, Twitter). ' +
          '"networkidle" is rarely needed and will timeout on SPAs.',
        enum: ['load', 'domcontentloaded', 'networkidle'],
      },
    },
    required: ['url'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { url, waitUntil = 'load' } = params;

      const browser = context.getBrowserManager();
      await browser.navigate(url, { waitUntil });

      const title = await browser.getTitle();
      const page = browser.getPage();

      // Auto-scan page after navigation so LLM immediately has real selectors
      logger.bullet('Auto-scanning page after navigation...');
      const intel = await scanPage(page);
      await injectHighlights(page, intel);
      const pagePayload = formatForLLM(intel);

      return {
        success: true,
        message: `Navigated to ${url}. ${intel.summary}`,
        data: {
          url: browser.getUrl(),
          title,
          pageIntelligence: pagePayload,
        },
      };
    } catch (error) {
      logger.error(`Navigate tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
