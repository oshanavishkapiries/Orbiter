import { LLMProvider, Message } from '../../llm/types.js';
import { getToolRegistry } from '../../tools/registry.js';
import { ExecutionContext } from '../execution-context.js';
import { logger } from '../../cli/ui/logger.js';
import { RecoveryPromptBuilder } from './recovery-prompt.js';
import {
  ErrorContext,
  RecoveryPlan,
  RecoveryAttemptRecord,
  RecoveryStrategy,
} from './types.js';
import chalk from 'chalk';
import boxen from 'boxen';

export class RecoveryEngine {
  private maxRecoveryAttempts = 3;

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
  ) {}

  /**
   * Attempt to recover from an error
   */
  async recover(errorContext: ErrorContext): Promise<{
    success: boolean;
    result?: any;
    shouldAbort: boolean;
    abortReason?: string;
  }> {
    // Check if we should even try to recover
    if (this.shouldSkipRecovery(errorContext)) {
      return {
        success: false,
        shouldAbort: true,
        abortReason: this.getSkipReason(errorContext),
      };
    }

    logger.info('Analyzing error for recovery...');

    // Display error context in CLI
    this.displayErrorContext(errorContext);

    // Get recovery plan from LLM
    const plan = await this.getLLMRecoveryPlan(errorContext);

    if (!plan) {
      return {
        success: false,
        shouldAbort: false,
      };
    }

    // Display recovery plan
    this.displayRecoveryPlan(plan);

    // Check if LLM says to abort
    if (plan.shouldAbort) {
      return {
        success: false,
        shouldAbort: true,
        abortReason: plan.abortReason || plan.reasoning,
      };
    }

    // Execute recovery action
    const result = await this.executeRecoveryAction(plan, errorContext);

    // Record recovery attempt
    const attempt: RecoveryAttemptRecord = {
      attemptNumber: errorContext.recoveryHistory.length + 1,
      strategy: plan.strategy,
      reasoning: plan.reasoning,
      action: plan.action,
      result: result.success ? 'success' : 'failed',
      error: result.error,
      timestamp: Date.now(),
    };

    errorContext.recoveryHistory.push(attempt);

    if (result.success) {
      logger.success('Recovery successful!');
    } else {
      logger.warn(`Recovery attempt failed: ${result.error}`);
    }

    return {
      success: result.success,
      result: result.data,
      shouldAbort: false,
    };
  }

  /**
   * Get recovery plan from LLM
   */
  private async getLLMRecoveryPlan(
    errorContext: ErrorContext,
  ): Promise<RecoveryPlan | null> {
    const prompt = RecoveryPromptBuilder.build(errorContext);

    try {
      logger.debug('Requesting LLM recovery plan...');

      const response = await this.llm.chat([
        {
          role: 'system',
          content:
            'You are a browser automation error recovery specialist. Analyze errors and provide precise recovery plans as JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      // Parse JSON from response
      const plan = this.parseRecoveryPlan(response.content);
      return plan;
    } catch (error) {
      logger.error(`Failed to get recovery plan: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Parse recovery plan from LLM response
   */
  private parseRecoveryPlan(content: string): RecoveryPlan | null {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.debug('No JSON found in LLM response');
        return null;
      }

      const plan = JSON.parse(jsonMatch[0]) as RecoveryPlan;

      // Validate required fields
      if (!plan.strategy || !plan.reasoning) {
        logger.debug('Invalid recovery plan structure');
        return null;
      }

      return plan;
    } catch (error) {
      logger.debug(
        `Failed to parse recovery plan: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Execute the recovery action
   */
  private async executeRecoveryAction(
    plan: RecoveryPlan,
    errorContext: ErrorContext,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const registry = getToolRegistry();

    try {
      switch (plan.strategy) {
        case 'try_alternative_selector': {
          if (!plan.action) {
            return { success: false, error: 'No action provided' };
          }

          logger.info(
            `Trying alternative selector: ${plan.action.params.selector}`,
          );

          const result = await registry.execute(
            plan.action.tool,
            plan.action.params,
            this.context,
          );

          return {
            success: result.success,
            data: result.data,
            error: result.error,
          };
        }

        case 'wait_and_retry': {
          const waitTime = plan.waitBeforeRetry || 3000;
          logger.info(`Waiting ${waitTime}ms before retry...`);

          await new Promise((r) => setTimeout(r, waitTime));

          if (plan.action) {
            const result = await registry.execute(
              plan.action.tool,
              plan.action.params,
              this.context,
            );
            return {
              success: result.success,
              data: result.data,
              error: result.error,
            };
          }

          // Retry original action
          const originalResult = await registry.execute(
            errorContext.failedAction.tool,
            errorContext.failedAction.params,
            this.context,
          );

          return {
            success: originalResult.success,
            data: originalResult.data,
            error: originalResult.error,
          };
        }

        case 'refresh_and_retry': {
          logger.info('Refreshing page...');
          const page = this.context.getBrowserManager().getPage();
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);

          if (plan.action) {
            const result = await registry.execute(
              plan.action.tool,
              plan.action.params,
              this.context,
            );
            return {
              success: result.success,
              data: result.data,
              error: result.error,
            };
          }

          const retryResult = await registry.execute(
            errorContext.failedAction.tool,
            errorContext.failedAction.params,
            this.context,
          );

          return {
            success: retryResult.success,
            data: retryResult.data,
            error: retryResult.error,
          };
        }

        case 'scroll_and_retry': {
          logger.info('Scrolling to find element...');
          const page = this.context.getBrowserManager().getPage();

          // Scroll down a bit
          await page.evaluate(() => window.scrollBy(0, 300));
          await page.waitForTimeout(1000);

          if (plan.action) {
            const result = await registry.execute(
              plan.action.tool,
              plan.action.params,
              this.context,
            );
            return {
              success: result.success,
              data: result.data,
              error: result.error,
            };
          }

          const scrollResult = await registry.execute(
            errorContext.failedAction.tool,
            errorContext.failedAction.params,
            this.context,
          );

          return {
            success: scrollResult.success,
            data: scrollResult.data,
            error: scrollResult.error,
          };
        }

        case 'wait_for_element': {
          if (!plan.action) {
            return { success: false, error: 'No selector to wait for' };
          }

          logger.info(`Waiting for element: ${plan.action.params.selector}`);

          const waitResult = await registry.execute(
            'wait',
            {
              type: 'selector',
              selector: plan.action.params.selector,
              timeout: 10000,
            },
            this.context,
          );

          if (!waitResult.success) {
            return { success: false, error: 'Element never appeared' };
          }

          // Now retry original action
          const retryResult = await registry.execute(
            errorContext.failedAction.tool,
            errorContext.failedAction.params,
            this.context,
          );

          return {
            success: retryResult.success,
            data: retryResult.data,
            error: retryResult.error,
          };
        }

        case 'dismiss_overlay': {
          logger.info('Attempting to dismiss overlay/modal...');
          const page = this.context.getBrowserManager().getPage();

          // Try common dismiss actions
          const dismissSelectors = [
            'button[aria-label="Close"]',
            'button[aria-label="close"]',
            '.modal-close',
            '.close-btn',
            '[class*="close"]',
            '[class*="dismiss"]',
            'button:has-text("Accept")',
            'button:has-text("Got it")',
            'button:has-text("No thanks")',
          ];

          let dismissed = false;
          for (const sel of dismissSelectors) {
            try {
              const el = await page.$(sel);
              if (el) {
                await el.click();
                await page.waitForTimeout(1000);
                dismissed = true;
                logger.debug(`Dismissed overlay with: ${sel}`);
                break;
              }
            } catch {
              continue;
            }
          }

          if (!dismissed) {
            // Try pressing Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }

          // Retry original action
          const retryResult = await registry.execute(
            errorContext.failedAction.tool,
            errorContext.failedAction.params,
            this.context,
          );

          return {
            success: retryResult.success,
            data: retryResult.data,
            error: retryResult.error,
          };
        }

        case 'navigate_alternative': {
          if (!plan.action) {
            return { success: false, error: 'No alternative URL provided' };
          }

          logger.info(`Navigating to alternative: ${plan.action.params.url}`);

          const navResult = await registry.execute(
            'navigate',
            plan.action.params,
            this.context,
          );

          return {
            success: navResult.success,
            data: navResult.data,
            error: navResult.error,
          };
        }

        case 'abort_with_partial': {
          logger.info('Aborting with partial results');
          return {
            success: false,
            error: 'Aborted with partial results',
          };
        }

        case 'abort':
        default:
          return {
            success: false,
            error: plan.reasoning,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if recovery should be skipped
   */
  private shouldSkipRecovery(context: ErrorContext): boolean {
    // Too many attempts
    if (context.recoveryHistory.length >= this.maxRecoveryAttempts) {
      return true;
    }

    // Captcha - cannot recover
    if (context.browserState.domSummary.hasCaptcha) {
      return true;
    }

    // Critical error
    if (context.error.severity === 'critical') {
      return true;
    }

    return false;
  }

  /**
   * Get reason for skipping recovery
   */
  private getSkipReason(context: ErrorContext): string {
    if (context.recoveryHistory.length >= this.maxRecoveryAttempts) {
      return `Max recovery attempts (${this.maxRecoveryAttempts}) reached`;
    }
    if (context.browserState.domSummary.hasCaptcha) {
      return 'CAPTCHA detected - cannot recover automatically';
    }
    if (context.error.severity === 'critical') {
      return 'Critical error - cannot recover';
    }
    return 'Recovery skipped';
  }

  /**
   * Display error context in CLI
   */
  private displayErrorContext(context: ErrorContext): void {
    const { error, failedAction, browserState } = context;

    const specialWarnings: string[] = [];
    if (browserState.domSummary.hasCaptcha)
      specialWarnings.push('⚠️  CAPTCHA DETECTED');
    if (browserState.domSummary.hasModal)
      specialWarnings.push('⚠️  MODAL IS OPEN');
    if (browserState.domSummary.hasOverlay)
      specialWarnings.push('⚠️  OVERLAY PRESENT');

    const content = [
      `Type:     ${chalk.red(error.type)}`,
      `Severity: ${this.colorSeverity(error.severity)}`,
      `Message:  ${error.message}`,
      '',
      `Tool:     ${chalk.cyan(failedAction.tool)}`,
      failedAction.selector
        ? `Selector: ${chalk.gray(failedAction.selector)}`
        : '',
      '',
      `URL:      ${chalk.gray(browserState.url)}`,
      `Title:    ${chalk.gray(browserState.title)}`,
      browserState.screenshotPath
        ? `Screenshot: ${chalk.gray(browserState.screenshotPath)}`
        : '',
      '',
      specialWarnings.length > 0
        ? chalk.yellow(specialWarnings.join('\n'))
        : '',
      '',
      chalk.bold('Available elements:'),
      ...browserState.domSummary.clickableElements
        .slice(0, 8)
        .map((el) => `  ${chalk.gray(el)}`),
    ]
      .filter(Boolean)
      .join('\n');

    console.log(
      '\n' +
        boxen(content, {
          title: '🔴 ERROR DETECTED',
          titleAlignment: 'left',
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red',
        }),
    );
  }

  /**
   * Display recovery plan in CLI
   */
  private displayRecoveryPlan(plan: RecoveryPlan): void {
    const content = [
      `Strategy:   ${chalk.cyan(plan.strategy)}`,
      `Confidence: ${this.colorConfidence(plan.confidence)}`,
      `Reasoning:  ${plan.reasoning}`,
      plan.action
        ? `\nAction:\n  Tool: ${chalk.cyan(plan.action.tool)}\n  Params: ${chalk.gray(JSON.stringify(plan.action.params))}`
        : '',
      plan.waitBeforeRetry
        ? `\nWaiting: ${plan.waitBeforeRetry}ms before retry`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    console.log(
      '\n' +
        boxen(content, {
          title: '💡 LLM RECOVERY PLAN',
          titleAlignment: 'left',
          padding: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
        }),
    );
  }

  private colorSeverity(severity: string): string {
    const colors: Record<string, any> = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed,
    };
    return (colors[severity] || chalk.white)(severity);
  }

  private colorConfidence(confidence: string): string {
    const colors: Record<string, any> = {
      high: chalk.green,
      medium: chalk.yellow,
      low: chalk.red,
    };
    return (colors[confidence] || chalk.white)(confidence);
  }
}
