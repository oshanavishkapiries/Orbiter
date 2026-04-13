import { Page } from 'playwright';
import { UrlPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';

export class UrlPaginationHandler {
  private currentPage: number;

  constructor(
    private page: Page,
    private config: UrlPagination,
  ) {
    this.currentPage = config.startPage;
  }

  /**
   * Navigate to next page URL
   * Returns true if navigated, false if no more pages
   */
  async next(): Promise<boolean> {
    const maxPages = this.config.maxPages || 50;
    const waitTime = this.config.waitAfterNavigate || 2000;

    this.currentPage++;

    if (this.currentPage > maxPages) {
      logger.debug(`Max pages reached: ${maxPages}`);
      return false;
    }

    // Build URL
    const url = this.config.urlTemplate.replace(
      '{{PAGE}}',
      String(this.currentPage),
    );

    logger.debug(`Navigating to page ${this.currentPage}: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(waitTime);
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
