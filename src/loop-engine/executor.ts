import { Page } from 'playwright';
import { logger } from '../cli/ui/logger.js';
import { createProgressBar } from '../cli/ui/progress.js';
import { generateId } from '../utils/id.js';
import { PatternValidator } from './pattern-validator.js';
import { ScrollPaginationHandler } from './pagination/scroll-handler.js';
import { ClickNextPaginationHandler } from './pagination/click-next-handler.js';
import { UrlPaginationHandler } from './pagination/url-handler.js';
import {
  LoopTask,
  LoopResult,
  ExtractedItem,
  PaginationConfig,
} from './types.js';
import chalk from 'chalk';

export class LoopExecutor {
  private validator: PatternValidator;
  private results: ExtractedItem[] = [];
  private errors: string[] = [];
  private pagesProcessed = 0;

  constructor(private page: Page) {
    this.validator = new PatternValidator(page);
  }

  /**
   * Main execution method
   */
  async execute(task: LoopTask): Promise<LoopResult> {
    const startTime = Date.now();

    console.log('\n' + chalk.cyan.bold('🔄 LOOP ENGINE ACTIVATED'));
    console.log(chalk.gray(`  Task: ${task.name}`));
    console.log(chalk.gray(`  Mode: Pattern-based extraction (No LLM calls)`));
    console.log(
      chalk.gray(`  Max items: ${task.control.maxItems || 'unlimited'}`),
    );
    console.log('');

    // Step 1: Validate pattern on first item
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

    logger.success(
      `Pattern valid! Found ${validation.itemCount} items on first page`,
    );

    if (validation.sampleData) {
      console.log(chalk.gray('  Sample extraction:'));
      for (const [key, value] of Object.entries(validation.sampleData)) {
        console.log(chalk.gray(`    ${key}: ${value || '(empty)'}`));
      }
      console.log('');
    }

    // Step 2: Execute loop with pagination
    await this.runExtractionLoop(task);

    const duration = Date.now() - startTime;
    const result = this.buildResult(task, startTime, true, this.errors);

    // Display summary
    this.displaySummary(result);

    return result;
  }

  /**
   * Main extraction loop
   */
  private async runExtractionLoop(task: LoopTask): Promise<void> {
    const maxItems = task.control.maxItems || Infinity;
    const hasPagination =
      task.pattern.pagination && task.pattern.pagination.type !== 'none';

    // Setup progress bar
    const progress = createProgressBar(
      maxItems === Infinity ? 100 : maxItems,
      'Extracting',
    );

    let continueLoop = true;

    while (continueLoop) {
      this.pagesProcessed++;

      // Get all items on current page
      const items = await this.page.$$(task.pattern.itemSelector);

      logger.debug(`Page ${this.pagesProcessed}: found ${items.length} items`);

      // Extract each item
      for (let i = 0; i < items.length; i++) {
        // Check max items
        if (this.results.length >= maxItems) {
          continueLoop = false;
          break;
        }

        const item = items[i];
        const itemIndex = this.results.length + 1;

        progress.update(
          Math.min(this.results.length, maxItems as number),
          `Item ${itemIndex}: extracting...`,
        );

        try {
          // Extract from list view
          let data = await this.validator.extractFromElement(
            item,
            task.pattern.extractSchema,
          );

          // If detail page needed
          if (task.pattern.detailAction) {
            const detailData = await this.extractDetailPage(
              item,
              task.pattern.detailAction,
              itemIndex,
            );

            if (detailData) {
              data = { ...data, ...detailData };
            }
          }

          // Save result
          this.results.push({
            index: itemIndex,
            data,
            sourceUrl: this.page.url(),
            extractedAt: Date.now(),
          });

          progress.update(
            this.results.length,
            `Extracted: ${this.getDisplayValue(data)}`,
          );
        } catch (error) {
          const errorMsg = `Item ${itemIndex} failed: ${(error as Error).message}`;
          this.errors.push(errorMsg);
          logger.debug(errorMsg);

          if (task.control.onError === 'stop') {
            continueLoop = false;
            break;
          }
          // 'skip' → continue to next item
        }

        // Human-like delay between items
        await this.humanDelay(task.control.delayBetween);
      }

      // Check stop condition
      if (task.control.stopCondition) {
        const stopElement = await this.page.$(task.control.stopCondition);
        if (stopElement) {
          logger.debug(`Stop condition met: ${task.control.stopCondition}`);
          continueLoop = false;
        }
      }

      // Handle pagination
      if (continueLoop && hasPagination) {
        const hasMore = await this.handlePagination(
          task.pattern.pagination!,
          this.results.length,
        );

        if (!hasMore) {
          continueLoop = false;
        }
      } else {
        // No pagination, done after first page
        continueLoop = false;
      }
    }

    progress.stop();
  }

  /**
   * Extract data from detail page
   */
  private async extractDetailPage(
    listItem: any,
    detailAction: LoopTask['pattern']['detailAction'],
    itemIndex: number,
  ): Promise<Record<string, any> | null> {
    if (!detailAction) return null;

    const currentUrl = this.page.url();

    try {
      // Click into detail page
      const clickTarget = await listItem.$(detailAction.clickSelector);

      if (!clickTarget) {
        logger.debug(`Detail click target not found for item ${itemIndex}`);
        return null;
      }

      await clickTarget.click();

      // Wait for detail page to load
      await this.page.waitForSelector(detailAction.waitForSelector, {
        timeout: 10000,
      });

      // Small wait for dynamic content
      await this.page.waitForTimeout(500);

      // Extract additional data from detail page
      const detailData = await this.validator.extractFromElement(
        await this.page.$('body'),
        detailAction.extractSchema,
      );

      // Go back
      if (detailAction.backAction === 'browser.back') {
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle');
      } else if (detailAction.backAction === 'close.tab') {
        await this.page.goto(currentUrl);
      } else {
        // Custom back action selector
        const backButton = await this.page.$(detailAction.backAction);
        if (backButton) {
          await backButton.click();
          await this.page.waitForLoadState('networkidle');
        } else {
          await this.page.goBack();
        }
      }

      // Wait for list to reload
      if (detailAction.waitAfterBack) {
        await this.page.waitForTimeout(detailAction.waitAfterBack);
      } else {
        await this.page.waitForTimeout(1000);
      }

      return detailData;
    } catch (error) {
      logger.debug(
        `Detail extraction failed for item ${itemIndex}: ${(error as Error).message}`,
      );

      // Try to go back if something went wrong
      try {
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle');
      } catch {
        await this.page.goto(currentUrl);
      }

      return null;
    }
  }

  /**
   * Handle pagination
   */
  private async handlePagination(
    pagination: PaginationConfig,
    currentItemCount: number,
  ): Promise<boolean> {
    switch (pagination.type) {
      case 'scroll': {
        const handler = new ScrollPaginationHandler(this.page, pagination);
        return await handler.next(currentItemCount);
      }

      case 'click-next': {
        const handler = new ClickNextPaginationHandler(this.page, pagination);
        return await handler.next();
      }

      case 'url-based': {
        const handler = new UrlPaginationHandler(this.page, pagination);
        return await handler.next();
      }

      case 'none':
      default:
        return false;
    }
  }

  /**
   * Human-like random delay
   */
  private async humanDelay([min, max]: [number, number]): Promise<void> {
    const delay = min + Math.random() * (max - min);
    await this.page.waitForTimeout(delay);
  }

  /**
   * Get display value for progress bar
   */
  private getDisplayValue(data: Record<string, any>): string {
    // Try common name fields
    const nameFields = ['name', 'title', 'heading', 'label', 'text'];
    for (const field of nameFields) {
      if (data[field]) {
        const value = String(data[field]);
        return value.length > 30 ? value.slice(0, 30) + '...' : value;
      }
    }

    // Return first non-null value
    const firstValue = Object.values(data).find((v) => v);
    if (firstValue) {
      const value = String(firstValue);
      return value.length > 30 ? value.slice(0, 30) + '...' : value;
    }

    return 'extracted';
  }

  /**
   * Build result object
   */
  private buildResult(
    task: LoopTask,
    startTime: number,
    success: boolean,
    errors: string[],
  ): LoopResult {
    const duration = Date.now() - startTime;
    const successfulItems = this.results.length;
    const failedItems = errors.length;

    // Calculate savings estimate
    const traditionalCost = (successfulItems * 1500 * 3) / 1_000_000;
    const ourCost = (2000 * 3) / 1_000_000;
    const savings = (
      ((traditionalCost - ourCost) / traditionalCost) *
      100
    ).toFixed(1);

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

  /**
   * Display summary
   */
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
    console.log(
      `  Estimated savings vs traditional: ${chalk.green(result.estimatedSavings)} 💰`,
    );

    if (result.errors.length > 0) {
      console.log(chalk.bold('\nErrors:'));
      result.errors.slice(0, 5).forEach((e) => {
        console.log(`  ${chalk.red('✖')} ${e}`);
      });
      if (result.errors.length > 5) {
        console.log(chalk.gray(`  ... and ${result.errors.length - 5} more`));
      }
    }

    console.log('');
  }

  /**
   * Get extracted items
   */
  getResults(): ExtractedItem[] {
    return this.results;
  }
}
