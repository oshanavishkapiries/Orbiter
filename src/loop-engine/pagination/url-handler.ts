import { UrlPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';
import type { McpClient } from '../../mcp/client.js';

export class UrlPaginationHandler {
  private currentPage: number;

  constructor(
    private mcpClient: McpClient,
    private config: UrlPagination,
  ) {
    this.currentPage = config.startPage;
  }

  async next(): Promise<boolean> {
    const maxPages = this.config.maxPages || 50;
    const waitTime = this.config.waitAfterNavigate || 2000;

    this.currentPage++;

    if (this.currentPage > maxPages) {
      logger.debug(`Max pages reached: ${maxPages}`);
      return false;
    }

    const url = this.config.urlTemplate.replace(
      '{{PAGE}}',
      String(this.currentPage),
    );
    logger.debug(`Navigating to page ${this.currentPage}: ${url}`);

    try {
      await this.mcpClient.callTool('browser_navigate', { url });
      await this.mcpClient.delay(waitTime);
      return true;
    } catch (error) {
      logger.debug(`URL navigation failed: ${(error as Error).message}`);
      return false;
    }
  }

  getCurrentPage(): number {
    return this.currentPage;
  }
}
