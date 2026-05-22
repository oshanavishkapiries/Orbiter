import { logger } from '../cli/ui/logger.js';
import { createProgressBar } from '../cli/ui/progress.js';
import { generateId } from '../utils/id.js';
import { PatternValidator } from './pattern-validator.js';
import { ScrollPaginationHandler } from './pagination/scroll-handler.js';
import { ClickNextPaginationHandler } from './pagination/click-next-handler.js';
import { UrlPaginationHandler } from './pagination/url-handler.js';
import { LoopTask, LoopResult, ExtractedItem, PaginationConfig } from './types.js';
import type { McpClient } from '../mcp/client.js';
import chalk from 'chalk';

export class LoopExecutor {
  private validator: PatternValidator;
  private results: ExtractedItem[] = [];
  private errors: string[] = [];
  private pagesProcessed = 0;

  constructor(private mcpClient: McpClient) {
    this.validator = new PatternValidator(mcpClient);
  }

  async execute(task: LoopTask): Promise<LoopResult> {
    const startTime = Date.now();

    console.log('\n' + chalk.cyan.bold('🔄 LOOP ENGINE ACTIVATED'));
    console.log(chalk.gray(`  Task: ${task.name}`));
    console.log(chalk.gray(`  Mode: Pattern-based extraction (No LLM calls)`));
    console.log(chalk.gray(`  Max items: ${task.control.maxItems || 'unlimited'}`));
    console.log('');

    logger.info('Validating pattern...');

    const validation = await this.validator.validate({
      itemSelector: task.pattern.itemSelector,
      containerSelector: task.pattern.containerSelector,
      extractSchema: task.pattern.extractSchema,
      visibleItemCount: 0,
      hasPagination: !!task.pattern.pagination,
      confidence: 'high',
      reasoning: '',
    });

    if (!validation.valid) {
      const errorMsg = `Pattern validation failed: ${validation.errors.join(', ')}`;
      logger.error(errorMsg);
      return this.buildResult(task, startTime, false, [errorMsg]);
    }

    logger.success(`Pattern valid! Found ${validation.itemCount} items on first page`);

    if (validation.sampleData) {
      console.log(chalk.gray('  Sample extraction:'));
      for (const [key, value] of Object.entries(validation.sampleData)) {
        console.log(chalk.gray(`    ${key}: ${value || '(empty)'}`));
      }
      console.log('');
    }

    await this.runExtractionLoop(task);

    const result = this.buildResult(task, startTime, true, this.errors);
    this.displaySummary(result);
    return result;
  }

  private async runExtractionLoop(task: LoopTask): Promise<void> {
    const maxItems = task.control.maxItems || Infinity;
    const hasPagination = task.pattern.pagination && task.pattern.pagination.type !== 'none';

    const progress = createProgressBar(
      maxItems === Infinity ? 100 : maxItems,
      'Extracting',
    );

    let continueLoop = true;

    while (continueLoop) {
      this.pagesProcessed++;

      // Batch-extract all items on this page in a single evaluate call
      const pageItems = await this.validator.extractAllItems(
        task.pattern.itemSelector,
        task.pattern.extractSchema,
      );

      logger.debug(`Page ${this.pagesProcessed}: found ${pageItems.length} items`);

      for (let i = 0; i < pageItems.length; i++) {
        if (this.results.length >= maxItems) {
          continueLoop = false;
          break;
        }

        const itemIndex = this.results.length + 1;
        progress.update(Math.min(this.results.length, maxItems as number), `Item ${itemIndex}: extracting...`);

        try {
          let data = pageItems[i];

          if (task.pattern.detailAction) {
            const detailData = await this.extractDetailPage(i, task.pattern.detailAction, itemIndex);
            if (detailData) {
              data = { ...data, ...detailData };
            }
          }

          const sourceUrl = await this.mcpClient.getCurrentUrl();

          this.results.push({
            index: itemIndex,
            data,
            sourceUrl,
            extractedAt: Date.now(),
          });

          progress.update(this.results.length, `Extracted: ${this.getDisplayValue(data)}`);
        } catch (error) {
          const errorMsg = `Item ${itemIndex} failed: ${(error as Error).message}`;
          this.errors.push(errorMsg);
          logger.debug(errorMsg);

          if (task.control.onError === 'stop') {
            continueLoop = false;
            break;
          }
        }

        await this.humanDelay(task.control.delayBetween);
      }

      // Check stop condition
      if (task.control.stopCondition) {
        const stopFound: boolean = await this.mcpClient
          .evaluate(`!!document.querySelector(${JSON.stringify(task.control.stopCondition)})`)
          .catch(() => false);
        if (stopFound) {
          logger.debug(`Stop condition met: ${task.control.stopCondition}`);
          continueLoop = false;
        }
      }

      if (continueLoop && hasPagination) {
        const hasMore = await this.handlePagination(task.pattern.pagination!, this.results.length);
        if (!hasMore) continueLoop = false;
      } else {
        continueLoop = false;
      }
    }

    progress.stop();
  }

  private async extractDetailPage(
    listIndex: number,
    detailAction: LoopTask['pattern']['detailAction'],
    itemIndex: number,
  ): Promise<Record<string, any> | null> {
    if (!detailAction) return null;

    const currentUrl = await this.mcpClient.getCurrentUrl();

    try {
      // Get the click target href or click it by index
      const clickExpr = `
        (() => {
          const items = document.querySelectorAll(${JSON.stringify(detailAction.clickSelector)});
          const target = items[${listIndex}] || document.querySelectorAll('[data-index="${listIndex}"]')[0];
          return target ? true : false;
        })()
      `;
      const hasTarget = await this.mcpClient.evaluate(clickExpr);

      if (!hasTarget) {
        logger.debug(`Detail click target not found for item ${itemIndex}`);
        return null;
      }

      await this.mcpClient.callTool('browser_click', { element: detailAction.clickSelector });
      await this.mcpClient.callTool('browser_wait_for', { selector: detailAction.waitForSelector });
      await this.mcpClient.delay(500);

      const detailData = await this.validator.extractItemAtIndex(
        0,
        'body',
        detailAction.extractSchema,
      );

      if (detailAction.backAction === 'browser.back') {
        await this.mcpClient.callTool('browser_navigate_back', {});
      } else if (detailAction.backAction === 'close.tab') {
        await this.mcpClient.callTool('browser_navigate', { url: currentUrl });
      } else {
        // Try custom back selector first, fall back to navigate back
        try {
          await this.mcpClient.callTool('browser_click', { element: detailAction.backAction });
        } catch {
          await this.mcpClient.callTool('browser_navigate_back', {});
        }
      }

      const waitAfter = detailAction.waitAfterBack ?? 1000;
      await this.mcpClient.delay(waitAfter);

      return detailData;
    } catch (error) {
      logger.debug(`Detail extraction failed for item ${itemIndex}: ${(error as Error).message}`);
      try {
        await this.mcpClient.callTool('browser_navigate_back', {});
      } catch {
        await this.mcpClient.callTool('browser_navigate', { url: currentUrl });
      }
      return null;
    }
  }

  private async handlePagination(pagination: PaginationConfig, currentItemCount: number): Promise<boolean> {
    switch (pagination.type) {
      case 'scroll': {
        const handler = new ScrollPaginationHandler(this.mcpClient, pagination);
        return handler.next(currentItemCount);
      }
      case 'click-next': {
        const handler = new ClickNextPaginationHandler(this.mcpClient, pagination);
        return handler.next();
      }
      case 'url-based': {
        const handler = new UrlPaginationHandler(this.mcpClient, pagination);
        return handler.next();
      }
      default:
        return false;
    }
  }

  private async humanDelay([min, max]: [number, number]): Promise<void> {
    const delay = min + Math.random() * (max - min);
    await this.mcpClient.delay(delay);
  }

  private getDisplayValue(data: Record<string, any>): string {
    const nameFields = ['name', 'title', 'heading', 'label', 'text'];
    for (const field of nameFields) {
      if (data[field]) {
        const value = String(data[field]);
        return value.length > 30 ? value.slice(0, 30) + '...' : value;
      }
    }
    const firstValue = Object.values(data).find((v) => v);
    if (firstValue) {
      const value = String(firstValue);
      return value.length > 30 ? value.slice(0, 30) + '...' : value;
    }
    return 'extracted';
  }

  private buildResult(task: LoopTask, startTime: number, success: boolean, errors: string[]): LoopResult {
    const duration = Date.now() - startTime;
    const successfulItems = this.results.length;
    const failedItems = errors.length;

    const traditionalCost = (successfulItems * 1500 * 3) / 1_000_000;
    const ourCost = (2000 * 3) / 1_000_000;
    const savings = (((traditionalCost - ourCost) / Math.max(traditionalCost, 0.001)) * 100).toFixed(1);

    return {
      taskId: task.id,
      taskName: task.name,
      success,
      totalItems: successfulItems + failedItems,
      successfulItems,
      failedItems,
      pagesProcessed: this.pagesProcessed,
      duration,
      items: this.results,
      llmCallsUsed: 0,
      estimatedSavings: `${savings}%`,
      errors,
    };
  }

  private displaySummary(result: LoopResult): void {
    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log(chalk.green.bold('\n✅ LOOP ENGINE COMPLETE\n'));
    console.log(chalk.bold('Results:'));
    console.log(`  Items extracted: ${chalk.green(result.successfulItems)}`);
    if (result.failedItems > 0) {
      console.log(`  Items failed: ${chalk.red(result.failedItems)}`);
    }
    console.log(`  Pages processed: ${result.pagesProcessed}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(chalk.bold('\nPerformance:'));
    console.log(`  LLM calls in loop: ${chalk.green('0')}`);
    console.log(`  Loop cost: ${chalk.green('$0.00')}`);
    console.log(`  Estimated savings vs traditional: ${chalk.green(result.estimatedSavings)} 💰`);
    if (result.errors.length > 0) {
      console.log(chalk.bold('\nErrors:'));
      result.errors.slice(0, 5).forEach((e) => console.log(`  ${chalk.red('✖')} ${e}`));
      if (result.errors.length > 5) {
        console.log(chalk.gray(`  ... and ${result.errors.length - 5} more`));
      }
    }
    console.log('');
  }

  getResults(): ExtractedItem[] {
    return this.results;
  }
}
