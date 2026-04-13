import { Page } from 'playwright';
import { ScrollPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';

export class ScrollPaginationHandler {
  private scrollCount = 0;
  private lastItemCount = 0;

  constructor(
    private page: Page,
    private config: ScrollPagination,
  ) {}

  /**
   * Scroll to load more items
   * Returns true if more items loaded, false if no more
   */
  async next(currentItemCount: number): Promise<boolean> {
    const maxScrolls = this.config.maxScrolls || 20;
    const waitTime = this.config.waitAfterScroll || 1500;

    if (this.scrollCount >= maxScrolls) {
      logger.debug('Max scroll limit reached');
      return false;
    }

    // Check end condition
    if (this.config.endCondition) {
      const endElement = await this.page.$(this.config.endCondition);
      if (endElement) {
        logger.debug(`End condition found: ${this.config.endCondition}`);
        return false;
      }
    }

    // Perform scroll
    if (this.config.container) {
      // Scroll inside container
      await this.page.evaluate((containerSelector: string) => {
        const container = document.querySelector(containerSelector);
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, this.config.container);
    } else {
      // Scroll page
      await this.page.evaluate(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        });
      });
    }

    this.scrollCount++;

    // Wait for content to load
    await this.page.waitForTimeout(waitTime);

    // Check if new items loaded
    if (currentItemCount === this.lastItemCount) {
      logger.debug('No new items after scroll, stopping');
      return false;
    }

    this.lastItemCount = currentItemCount;

    logger.debug(
      `Scrolled ${this.scrollCount} times, items: ${currentItemCount}`,
    );
    return true;
  }

  reset(): void {
    this.scrollCount = 0;
    this.lastItemCount = 0;
  }

  getScrollCount(): number {
    return this.scrollCount;
  }
}
