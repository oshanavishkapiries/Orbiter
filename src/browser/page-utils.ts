import { Page, ElementHandle } from 'playwright';
import { logger } from '../cli/ui/logger.js';

export class PageUtils {
  constructor(private page: Page) {}

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get element text
   */
  async getElementText(selector: string): Promise<string | null> {
    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.textContent();
    } catch (error) {
      logger.error(`Error getting text from ${selector}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Get element attribute
   */
  async getElementAttribute(selector: string, attribute: string): Promise<string | null> {
    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.getAttribute(attribute);
    } catch (error) {
      logger.error(`Error getting attribute from ${selector}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Get all matching elements
   */
  async getAllElements(selector: string): Promise<ElementHandle[]> {
    try {
      return await this.page.$$(selector);
    } catch (error) {
      logger.error(`Error finding elements ${selector}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get element count
   */
  async getElementCount(selector: string): Promise<number> {
    const elements = await this.getAllElements(selector);
    return elements.length;
  }

  /**
   * Scroll to element
   */
  async scrollToElement(selector: string): Promise<void> {
    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.scrollIntoViewIfNeeded();
        logger.debug(`Scrolled to element: ${selector}`);
      }
    } catch (error) {
      logger.error(`Error scrolling to ${selector}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Scroll page
   */
  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount?: number): Promise<void> {
    const scrollAmount = amount ?? 500;

    await this.page.evaluate(
      ({ direction, amount }) => {
        if (direction === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (direction === 'bottom') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else if (direction === 'down') {
          window.scrollBy({ top: amount, behavior: 'smooth' });
        } else if (direction === 'up') {
          window.scrollBy({ top: -amount, behavior: 'smooth' });
        }
      },
      { direction, amount: scrollAmount }
    );

    logger.debug(`Scrolled ${direction} by ${scrollAmount}px`);
  }

  /**
   * Wait for page to be stable (no network activity)
   */
  async waitForStable(timeout: number = 3000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Get page dimensions
   */
  async getPageDimensions(): Promise<{ width: number; height: number; scrollHeight: number }> {
    return await this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollHeight: document.body.scrollHeight,
    }));
  }

  /**
   * Check if page is scrollable
   */
  async isScrollable(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return document.body.scrollHeight > window.innerHeight;
    });
  }

  /**
   * Get visible elements summary
   */
  async getVisibleElementsSummary(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const visible: string[] = [];

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          window.getComputedStyle(el).visibility !== 'hidden' &&
          window.getComputedStyle(el).display !== 'none';

        if (isVisible && visible.length < 50) {
          // Limit to 50
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
          visible.push(`${tag}${id}${classes}`);
        }
      });

      return visible;
    });
  }
}