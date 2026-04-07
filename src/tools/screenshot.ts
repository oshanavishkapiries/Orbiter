import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const screenshotTool: ToolDefinition = {
  name: 'screenshot',
  description: 'Take a screenshot of the current page.',
  parameters: {
    type: 'object',
    properties: {
      fullPage: {
        type: 'boolean',
        description: 'Capture full scrollable page (default: false)',
      },
      selector: {
        type: 'string',
        description: 'CSS selector of element to screenshot (optional)',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { fullPage = false, selector } = params;

      const browser = context.getBrowserManager();
      const page = browser.getPage();

      let screenshotPath: string;

      if (selector) {
        // Screenshot specific element
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        screenshotPath = `./errors/element-${Date.now()}.png`;
        await element.screenshot({ path: screenshotPath });
      } else {
        // Screenshot page
        screenshotPath = await browser.screenshot({ fullPage });
      }

      return {
        success: true,
        message: `Screenshot saved to ${screenshotPath}`,
        screenshot: screenshotPath,
      };
    } catch (error) {
      logger.error(`Screenshot tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
