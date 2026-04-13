import { Page } from 'playwright';
import { ClickNextPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';

export class ClickNextPaginationHandler {
  private currentPage = 1;

  constructor(
    private page: Page,
    private config: ClickNextPagination,
  ) {}

  /**
   * Click next page button
   * Returns true if navigated, false if no more pages
   */
  async next(): Promise<boolean> {
    const maxPages = this.config.maxPages || 100;
    const waitTime = this.config.waitAfterClick || 2000;

    if (this.currentPage >= maxPages) {
      logger.debug(`Max pages reached: ${maxPages}`);
      return false;
    }

    try {
      // Find next button
      const nextButton = await this.page.$(this.config.nextButtonSelector);

      if (!nextButton) {
        logger.debug('Next button not found, no more pages');
        return false;
      }

      // Check if disabled
      if (this.config.disabledClass) {
        const isDisabled = await nextButton.evaluate(
          (el: Element, cls: string) => el.classList.contains(cls),
          this.config.disabledClass,
        );

        if (isDisabled) {
          logger.debug('Next button is disabled, last page reached');
          return false;
        }
      }

      // Check aria-disabled
      const ariaDisabled = await nextButton.getAttribute('aria-disabled');
      if (ariaDisabled === 'true') {
        logger.debug('Next button aria-disabled, last page reached');
        return false;
      }

      // Click next
      await nextButton.click();
      this.currentPage++;

      // Wait for page to load
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      await this.page.waitForTimeout(waitTime);

      logger.debug(`Navigated to page ${this.currentPage}`);
      return true;
    } catch (error) {
      logger.debug(`Click next failed: ${(error as Error).message}`);
      return false;
    }
  }

  getCurrentPage(): number {
    return this.currentPage;
  }
}
