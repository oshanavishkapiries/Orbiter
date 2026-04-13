import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { LoopExecutor } from '../loop-engine/executor.js';
import { OutputFormatter } from '../recorder/output-formatter.js';
import { generateId } from '../utils/id.js';
import { logger } from '../cli/ui/logger.js';
import { LoopTask, DetectedPattern } from '../loop-engine/types.js';
import chalk from 'chalk';

export const detectPatternTool: ToolDefinition = {
  name: 'detect_repetitive_pattern',

  description: `
Use this tool when you detect a page with REPEATING elements such as:
- Lists of products, hotels, restaurants, jobs, articles
- Search results with multiple items
- Tables with data rows
- Any repeating card/item layout

This tool hands off to the Loop Engine which extracts ALL items
WITHOUT further LLM calls, saving significant cost and time.

WHEN TO USE:
- User wants to "extract all", "get all", "list all", "scrape all"
- Page shows multiple similar items in a list/grid
- You can identify a consistent pattern of elements

HOW TO USE:
- Identify the CSS selector for each repeating item
- Define what fields to extract from each item
- Specify pagination type if items span multiple pages
- Optionally define detail page extraction
  `,

  parameters: {
    type: 'object',
    properties: {
      taskName: {
        type: 'string',
        description:
          'Descriptive name for this extraction task (e.g., "Google Maps Hotels")',
      },
      itemSelector: {
        type: 'string',
        description: 'CSS selector that matches EACH repeating item',
      },
      containerSelector: {
        type: 'string',
        description:
          'CSS selector of the container holding all items (optional)',
      },
      extractSchema: {
        type: 'object',
        description: `Object mapping field names to CSS selectors.
Examples:
{
  "name": "h2.title",
  "price": ".price-value",
  "rating": "span.stars",
  "url": {"selector": "a", "method": "attribute", "attribute": "href"}
}`,
      },
      hasPagination: {
        type: 'boolean',
        description: 'Whether items span multiple pages',
      },
      paginationType: {
        type: 'string',
        description: 'How to navigate to next page',
        enum: ['scroll', 'click-next', 'url-based', 'none'],
      },
      paginationConfig: {
        type: 'object',
        description: `Pagination settings:
For scroll: { "container": ".results-list", "maxScrolls": 10 }
For click-next: { "nextButtonSelector": "button.next-page", "maxPages": 5 }
For url-based: { "urlTemplate": "https://site.com/page/{{PAGE}}", "startPage": 1, "maxPages": 10 }`,
      },
      hasDetailPages: {
        type: 'boolean',
        description: 'Whether we need to click into each item for more data',
      },
      detailAction: {
        type: 'object',
        description: `Detail page config:
{
  "clickSelector": "a.item-link",
  "waitForSelector": ".detail-container",
  "extractSchema": { "description": ".full-desc", "phone": ".contact-phone" },
  "backAction": "browser.back"
}`,
      },
      maxItems: {
        type: 'number',
        description: 'Maximum number of items to extract (optional)',
      },
      confidence: {
        type: 'string',
        description: 'Your confidence in this pattern',
        enum: ['high', 'medium', 'low'],
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why you detected this pattern',
      },
    },
    required: [
      'taskName',
      'itemSelector',
      'extractSchema',
      'hasPagination',
      'paginationType',
      'confidence',
      'reasoning',
    ],
  },

  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    logger.info('Pattern detected by LLM, activating Loop Engine...');

    console.log('\n' + chalk.cyan.bold('🔍 PATTERN DETECTED'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`  Item selector: ${params.itemSelector}`));
    console.log(
      chalk.gray(`  Fields: ${Object.keys(params.extractSchema).join(', ')}`),
    );
    console.log(chalk.gray(`  Pagination: ${params.paginationType}`));
    console.log(chalk.gray(`  Confidence: ${params.confidence}`));
    console.log(chalk.gray(`  Reasoning: ${params.reasoning}`));
    console.log('');

    try {
      const page = context.getBrowserManager().getPage();

      // Build pagination config
      let paginationConfig: any = { type: params.paginationType || 'none' };

      if (params.hasPagination && params.paginationConfig) {
        paginationConfig = {
          type: params.paginationType,
          ...params.paginationConfig,
        };
      }

      // Build loop task
      const loopTask: LoopTask = {
        id: generateId('loop'),
        name: params.taskName,

        pattern: {
          containerSelector: params.containerSelector,
          itemSelector: params.itemSelector,
          extractSchema: params.extractSchema,
          pagination: paginationConfig,
          detailAction: params.hasDetailPages ? params.detailAction : undefined,
        },

        control: {
          maxItems: params.maxItems,
          delayBetween: [800, 1500],
          onError: 'skip',
          retryCount: 1,
        },
      };

      // Execute loop
      const executor = new LoopExecutor(page);
      const result = await executor.execute(loopTask);

      // Save output files
      const outputFiles: string[] = [];

      if (result.successfulItems > 0) {
        const formatter = new OutputFormatter();
        const filename = formatter.generateFilename(params.taskName);
        const files = formatter.saveAll(
          result.items.map((item) => item.data),
          filename,
        );
        outputFiles.push(...files);
      }

      return {
        success: result.success,
        message: `Loop Engine extracted ${result.successfulItems} items from ${result.pagesProcessed} page(s)`,
        data: {
          totalItems: result.successfulItems,
          pagesProcessed: result.pagesProcessed,
          duration: result.duration,
          outputFiles,
          llmCallsUsed: 0,
          estimatedSavings: result.estimatedSavings,
          items: result.items.slice(0, 5), // Return first 5 as sample
        },
        error: result.success ? undefined : result.errors[0],
      };
    } catch (error) {
      logger.error(`Loop Engine error: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
