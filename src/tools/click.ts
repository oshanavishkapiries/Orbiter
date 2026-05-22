import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const clickTool: ToolDefinition = {
  name: 'click',
  description: 'Click on an element. Use CSS selector to identify the element.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description:
          'CSS selector of the element to click (e.g., button#submit, .login-btn)',
      },
      waitAfter: {
        type: 'number',
        description: 'Milliseconds to wait after clicking (optional)',
      },
      force: {
        type: 'boolean',
        description: 'Force click even if element is not visible (optional)',
      },
    },
    required: ['selector'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { selector, waitAfter = 0, force = false } = params;

      const page = context.getBrowserManager().getPage();

      // Use locator so Playwright handles multiple matches gracefully.
      // .first() picks the first match; visible() prefers the visible one.
      const locator = page.locator(selector).first();

      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ force, timeout: 10000 });

      if (waitAfter > 0) {
        await page.waitForTimeout(waitAfter);
      }

      return {
        success: true,
        message: `Clicked on ${selector}`,
      };
    } catch (error) {
      logger.error(`Click tool error: ${(error as Error).message}`);

      // Take screenshot on error
      const screenshot = await context.getBrowserManager().screenshot();

      return {
        success: false,
        error: (error as Error).message,
        screenshot,
      };
    }
  },
};
