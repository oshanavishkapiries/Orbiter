import { ClickNextPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';
import type { McpClient } from '../../mcp/client.js';

export class ClickNextPaginationHandler {
  private currentPage = 1;

  constructor(
    private mcpClient: McpClient,
    private config: ClickNextPagination,
  ) {}

  async next(): Promise<boolean> {
    const maxPages = this.config.maxPages || 100;
    const waitTime = this.config.waitAfterClick || 2000;

    if (this.currentPage >= maxPages) {
      logger.debug(`Max pages reached: ${maxPages}`);
      return false;
    }

    try {
      const buttonInfo: { exists: boolean; disabled: boolean } = await this.mcpClient.evaluate(`
        (() => {
          const btn = document.querySelector(${JSON.stringify(this.config.nextButtonSelector)});
          if (!btn) return { exists: false, disabled: false };
          const disabledClass = ${JSON.stringify(this.config.disabledClass || '')};
          const isDisabled = (disabledClass && btn.classList.contains(disabledClass)) ||
                             btn.getAttribute('aria-disabled') === 'true' ||
                             btn.disabled === true;
          return { exists: true, disabled: isDisabled };
        })()
      `);

      if (!buttonInfo.exists) {
        logger.debug('Next button not found, no more pages');
        return false;
      }

      if (buttonInfo.disabled) {
        logger.debug('Next button is disabled, last page reached');
        return false;
      }

      await this.mcpClient.callTool('browser_click', {
        element: this.config.nextButtonSelector,
      });
      this.currentPage++;

      await this.mcpClient.callTool('browser_wait_for', { time: waitTime });

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
