import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { resolveLocator, LOCATOR_PARAMS, specDescription, LocatorSpec } from '../browser/locator.js';
import { logger } from '../cli/ui/logger.js';

export const waitTool: ToolDefinition = {
  name: 'wait',
  description:
    'Wait for a condition. Use "element" to wait for a specific element to appear, ' +
    '"time" to pause for a fixed duration, "load" to wait for the page load event.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: '"element" waits for an element, "time" waits a fixed duration, "load" waits for page load.',
        enum: ['element', 'time', 'load'],
      },
      ...LOCATOR_PARAMS,
      duration: {
        type: 'number',
        description: 'Milliseconds to wait (required when type=time)',
      },
      timeout: {
        type: 'number',
        description: 'Maximum wait time in ms (default: 30000)',
      },
    },
    required: ['type'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const { type, duration = 1000, timeout = 30000, ...spec } = params as {
        type: 'element' | 'time' | 'load';
        duration?: number;
        timeout?: number;
      } & LocatorSpec;

      const page = context.getBrowserManager().getPage();

      if (type === 'element') {
        const locator = resolveLocator(page, spec).first();
        await locator.waitFor({ state: 'visible', timeout });
        const desc = specDescription(spec);
        logger.success(`Element appeared: ${desc}`);
        return { success: true, message: `Element appeared: ${desc}` };
      }

      if (type === 'time') {
        await page.waitForTimeout(duration);
        return { success: true, message: `Waited ${duration}ms` };
      }

      if (type === 'load') {
        await page.waitForLoadState('load', { timeout });
        return { success: true, message: 'Page load event fired' };
      }

      throw new Error(`Unknown wait type: ${type}`);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};
