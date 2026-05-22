import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { McpClient } from '../mcp/client.js';
import { logger } from '../cli/ui/logger.js';

export const bulkExtractTool: ToolDefinition = {
  name: 'bulk_extract',
  description:
    'Extract data across multiple pages automatically. Runs a JS extraction expression on each page ' +
    'and navigates to the next page using the detected pagination pattern. ' +
    'Use after confirming your extractFn works on the first page with browser_evaluate.',
  parameters: {
    type: 'object',
    properties: {
      extractFn: {
        type: 'string',
        description:
          'JavaScript expression that returns an array of plain objects from the current page. ' +
          'Example: "Array.from(document.querySelectorAll(\'.result-card\')).map(el => ({ name: el.querySelector(\'.name\')?.textContent?.trim(), rating: el.querySelector(\'.rating\')?.textContent?.trim() }))"',
      },
      pagination: {
        type: 'object',
        description:
          'Pagination strategy. ' +
          'click_next: { type: "click_next", selector: "css-selector-of-next-button" } — clicks a Next button. ' +
          'url_page: { type: "url_page", urlTemplate: "https://example.com/page/{page}", startPage: 2 } — increments page number in URL (startPage = page number for the SECOND page). ' +
          'infinite_scroll: { type: "infinite_scroll" } — scrolls to the bottom to trigger lazy loading.',
      },
      maxPages: {
        type: 'number',
        description: 'Maximum number of pages to scrape (default: 10, max: 100)',
      },
      waitMs: {
        type: 'number',
        description: 'Milliseconds to wait after each page change for content to load (default: 1500)',
      },
    },
    required: ['extractFn', 'pagination'],
  },

  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { extractFn, pagination, maxPages = 10 } = params;
    const waitMs: number = params.waitMs ?? pagination.waitMs ?? 1500;
    const mcpClient = context.getMcpClient();

    const clampedMax = Math.min(maxPages, 100);
    const allData: any[] = [];
    const seen = new Set<string>();

    function addNew(items: any[]): number {
      let added = 0;
      for (const item of items) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          allData.push(item);
          added++;
        }
      }
      return added;
    }

    // ── Page 1 ──────────────────────────────────────────────────────────────
    logger.info(`bulk_extract: page 1 / max ${clampedMax}`);
    const firstPage = await runExtractFn(mcpClient, extractFn);
    if (firstPage.length === 0) {
      return {
        success: false,
        error: 'bulk_extract: extractFn returned no items on the first page. Verify the selector and page state with browser_evaluate before calling bulk_extract.',
      };
    }
    addNew(firstPage);
    logger.bullet(`Page 1: ${firstPage.length} items (total: ${allData.length})`);

    // ── Pagination loop ──────────────────────────────────────────────────────
    for (let page = 2; page <= clampedMax; page++) {
      const navigated = await goToNextPage(mcpClient, pagination, page, waitMs);
      if (!navigated) {
        logger.bullet(`No next page found after page ${page - 1} — stopping`);
        break;
      }

      logger.info(`bulk_extract: page ${page} / max ${clampedMax}`);
      const items = await runExtractFn(mcpClient, extractFn);

      if (items.length === 0) {
        logger.bullet(`Page ${page}: extractFn returned 0 items — stopping`);
        break;
      }

      const added = addNew(items);
      logger.bullet(`Page ${page}: ${items.length} items extracted, ${added} new (total: ${allData.length})`);

      if (added === 0) {
        logger.bullet(`Page ${page}: all items already seen — stopping`);
        break;
      }
    }

    if (allData.length === 0) {
      return { success: false, error: 'bulk_extract: no data collected across all pages' };
    }

    return {
      success: true,
      message: `Collected ${allData.length} records across pages`,
      data: allData,
    };
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function runExtractFn(mcpClient: McpClient, extractFn: string): Promise<any[]> {
  try {
    // Support both expression form and function/arrow-function declaration form.
    // If extractFn evaluates to a function, call it; otherwise use the value directly.
    const wrapped = `JSON.stringify((function(){
      var _fn = (${extractFn});
      var _r = typeof _fn === 'function' ? _fn() : _fn;
      return Array.isArray(_r) ? _r : [];
    })())`;
    const result = await mcpClient.evaluate(wrapped);
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      try { return JSON.parse(result); } catch { return []; }
    }
    return [];
  } catch (err) {
    logger.error(`bulk_extract extractFn error: ${(err as Error).message}`);
    return [];
  }
}

async function goToNextPage(
  mcpClient: McpClient,
  pagination: Record<string, any>,
  nextPageNum: number,
  waitMs: number,
): Promise<boolean> {
  const { type, selector, urlTemplate, startPage = 2 } = pagination;

  switch (type) {
    case 'click_next': {
      const clickable = await mcpClient.evaluate(
        `(function(){
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          if (el.hasAttribute('disabled')) return false;
          if (el.getAttribute('aria-disabled') === 'true') return false;
          if (el.classList.contains('disabled')) return false;
          return true;
        })()`,
      );
      if (!clickable) return false;

      await mcpClient.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await mcpClient.delay(waitMs);
      return true;
    }

    case 'url_page': {
      // startPage is the page number used in the URL for page 2 of content
      const pageNum = startPage + (nextPageNum - 2);
      const url = urlTemplate.replace('{page}', String(pageNum));
      const navResult = await mcpClient.callTool('browser_navigate', { url });
      if (!navResult.success) return false;
      await mcpClient.delay(waitMs);
      return true;
    }

    case 'infinite_scroll': {
      const prevHeight = await mcpClient.evaluate('document.body.scrollHeight');
      await mcpClient.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await mcpClient.delay(waitMs);
      const newHeight = await mcpClient.evaluate('document.body.scrollHeight');
      return typeof newHeight === 'number' && typeof prevHeight === 'number' && newHeight > prevHeight;
    }

    default:
      logger.error(`bulk_extract: unknown pagination type "${type}"`);
      return false;
  }
}
