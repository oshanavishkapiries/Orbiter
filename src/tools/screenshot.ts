import path from 'path';
import fs from 'fs';
import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';
import { ensureDir } from '../utils/fs.js';
import { PATHS } from '../utils/paths.js';

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
        ensureDir(PATHS.errors);
        screenshotPath = path.join(PATHS.errors, `element-${Date.now()}.png`);
        await element.screenshot({ path: screenshotPath });
      } else {
        // Screenshot page
        screenshotPath = await browser.screenshot({ fullPage });
      }

      const result: ToolResult = {
        success: true,
        message: `Screenshot saved to ${screenshotPath}`,
        screenshot: screenshotPath,
      };

      // If the active LLM supports vision, attach base64 so the executor
      // can inject it as an actual image message (not just a file path).
      const llm = context.getLLM?.();
      if (llm?.supportsVision()) {
        try {
          const buffer = fs.readFileSync(screenshotPath);
          const ext    = path.extname(screenshotPath).replace('.', '') || 'png';
          const mime   = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          result.imageBase64 = `data:${mime};base64,${buffer.toString('base64')}`;
          logger.debug('Screenshot encoded as base64 for vision model');
        } catch (e) {
          logger.debug(`Base64 encoding failed: ${(e as Error).message}`);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Screenshot tool error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
