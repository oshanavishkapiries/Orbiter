import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

export const evaluateTool: ToolDefinition = {
  name: 'evaluate_js',
  description:
    'Evaluate JavaScript in the browser (DOM) context. ' +
    'Use a function for multi-line logic: "() => { return document.title; }" ' +
    'or a plain expression: "document.title". ' +
    'Great for inspecting element attributes, reading page state, or scraping data. ' +
    'Runs inside the page — use run_code for Playwright-level interactions.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description:
          'A JS expression or arrow function. ' +
          'Expression: "document.querySelector(\'input\')?.getAttribute(\'aria-label\')" ' +
          'Function:   "() => Array.from(document.querySelectorAll(\'input\')).map(i => ({ id: i.id, name: i.name, ariaLabel: i.getAttribute(\'aria-label\'), placeholder: i.placeholder }))"',
      },
    },
    required: ['code'],
  },
  execute: async (params: { code: string }, context: ExecutionContext): Promise<ToolResult> => {
    const page = context.getBrowserManager().getPage();
    try {
      const code = params.code.trim();

      // If it looks like a function, eval it in Node.js to get the function object,
      // then pass the function to page.evaluate() so Playwright serialises and
      // executes it in the browser context (return value comes back to Node.js).
      // Otherwise pass the raw string as a browser expression.
      const looksLikeFunction =
        code.startsWith('()') ||
        code.startsWith('async ()') ||
        code.startsWith('function') ||
        code.startsWith('async function');

      let result: any;
      if (looksLikeFunction) {
        // eslint-disable-next-line no-eval
        const fn = (0, eval)(`(${code})`);
        result = await page.evaluate(fn);
      } else {
        result = await page.evaluate(code);
      }

      const preview = JSON.stringify(result, null, 2).slice(0, 500);
      logger.success('evaluate_js completed');
      return { success: true, data: result, message: preview };
    } catch (error) {
      logger.error(`evaluate_js error: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  },
};
