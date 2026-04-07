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

      // Wait for element to be visible
      await page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000,
      });

      // Click
      await page.click(selector, { force });

      // Optional wait
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
