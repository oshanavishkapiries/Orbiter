import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const navigateTool: ToolDefinition = {
  name: 'navigate',
  description:
    'Navigate to a URL. Returns an accessibility snapshot of the loaded page so you immediately ' +
    'know what elements are available — no need to call snapshot separately after navigate.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to (must include http:// or https://)',
      },
      waitUntil: {
        type: 'string',
        description:
          '"load" (default) for most sites. "domcontentloaded" for SPAs (Google Maps, YouTube, Twitter). ' +
          '"networkidle" for pages that do async rendering before stabilising.',
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

      let snapshot = '';
      try {
        snapshot = await (page as any).ariaSnapshot();
      } catch {
        snapshot = '(accessibility tree unavailable)';
      }

      logger.success(`Navigated to ${url}`);

      return {
        success: true,
        message: `Navigated to "${title || url}"`,
        data: { url: browser.getUrl(), title, snapshot },
      };
    } catch (error) {
      logger.error(`Navigate error: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  },
};
