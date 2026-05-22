import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, specDescription, LOCATOR_PARAMS, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const clickTool: ToolDefinition = {
  name: 'click',
  description:
    'Click an element. Identify it using the role+name, label, placeholder, text, or testId ' +
    'values from the snapshot. Prefer role+name for buttons and links.',
  parameters: {
    type: 'object',
    properties: {
      ...LOCATOR_PARAMS,
      waitAfter: {
        type: 'number',
        description: 'Milliseconds to wait after clicking (optional)',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { waitAfter = 0, ...spec } = params as LocatorSpec & { waitAfter?: number };
      const page = context.getBrowserManager().getPage();
      const locator = resolveLocator(page, spec).first();

      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.click({ timeout: 10000 });

      if (waitAfter > 0) await page.waitForTimeout(waitAfter);

      logger.success(`Clicked ${specDescription(spec)}`);
      return { success: true, message: `Clicked ${specDescription(spec)}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
