import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, specDescription, LOCATOR_PARAMS, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const hoverTool: ToolDefinition = {
  name: 'hover',
  description: 'Hover over an element — useful for revealing dropdown menus or tooltips.',
  parameters: {
    type: 'object',
    properties: {
      ...LOCATOR_PARAMS,
      waitAfter: {
        type: 'number',
        description: 'Milliseconds to wait after hovering (default: 500)',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { waitAfter = 500, ...spec } = params as LocatorSpec & { waitAfter?: number };
      const page = context.getBrowserManager().getPage();
      const locator = resolveLocator(page, spec).first();

      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.hover();

      if (waitAfter > 0) await page.waitForTimeout(waitAfter);

      logger.success(`Hovered ${specDescription(spec)}`);
      return { success: true, message: `Hovered over ${specDescription(spec)}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
