import { ScrollPagination } from '../types.js';
import { logger } from '../../cli/ui/logger.js';
import type { McpClient } from '../../mcp/client.js';

export class ScrollPaginationHandler {
  private scrollCount = 0;
  private lastItemCount = 0;

  constructor(
    private mcpClient: McpClient,
    private config: ScrollPagination,
  ) {}

  async next(currentItemCount: number): Promise<boolean> {
    const maxScrolls = this.config.maxScrolls || 20;
    const waitTime = this.config.waitAfterScroll || 1500;

    if (this.scrollCount >= maxScrolls) {
      logger.debug('Max scroll limit reached');
      return false;
    }

    if (this.config.endCondition) {
      const found: boolean = await this.mcpClient
        .evaluate(
          `!!document.querySelector(${JSON.stringify(this.config.endCondition)})`,
        )
        .catch(() => false);
      if (found) {
        logger.debug(`End condition found: ${this.config.endCondition}`);
        return false;
      }
    }

    if (this.config.container) {
      await this.mcpClient.evaluate(`
        (() => {
          const container = document.querySelector(${JSON.stringify(this.config.container)});
          if (container) container.scrollTop = container.scrollHeight;
        })()
      `);
    } else {
      await this.mcpClient.callTool('browser_scroll', {
        direction: 'down',
        coordinate: [760, 400],
      });
    }

    this.scrollCount++;
    await this.mcpClient.delay(waitTime);

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
