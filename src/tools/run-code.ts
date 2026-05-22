import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const runCodeTool: ToolDefinition = {
  name: 'run_code',
  description:
    'Execute Playwright code with full page access. Write an async arrow function ' +
    '"async (page) => { ... }" — the page argument is a live Playwright Page instance. ' +
    'You can call any Playwright API: page.locator(), page.click(), page.fill(), ' +
    'page.keyboard, page.waitForSelector(), page.evaluate(), etc. ' +
    'Return a value from the function to inspect it. ' +
    'Use this for any interaction that needs precision or fallback logic.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description:
          'Async arrow function string. The page parameter is a Playwright Page. ' +
          'Example: "async (page) => { await page.locator(\'input[aria-label=\\\"Search\\\"]\').fill(\'London\'); await page.keyboard.press(\'Enter\'); }"',
      },
    },
    required: ['code'],
  },
  execute: async (params: { code: string }, context: ExecutionContext): Promise<ToolResult> => {
    const page = context.getBrowserManager().getPage();
    try {
      // Indirect eval so the function string is parsed as a value expression,
      // not as a statement — avoids "function statement requires a name" errors.
      // This is intentional: the LLM writes arbitrary Playwright automation code.
      // eslint-disable-next-line no-eval
      const fn = (0, eval)(`(${params.code})`);

      if (typeof fn !== 'function') {
        return {
          success: false,
          error: 'code must be an async arrow function: async (page) => { ... }',
        };
      }

      const result = await fn(page);
      const preview =
        result === undefined ? 'Done' : JSON.stringify(result, null, 2).slice(0, 600);

      logger.success('run_code completed');
      return { success: true, data: result, message: preview };
    } catch (error) {
      logger.error(`run_code error: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  },
};
