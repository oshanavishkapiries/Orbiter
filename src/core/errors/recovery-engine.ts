import { LLMProvider } from '../../llm/types.js';
import { getToolRegistry } from '../../tools/registry.js';
import { ExecutionContext } from '../execution-context.js';
import { logger } from '../../cli/ui/logger.js';
import { RecoveryPromptBuilder } from './recovery-prompt.js';
import { ErrorContext, RecoveryPlan, RecoveryAttemptRecord } from './types.js';
import chalk from 'chalk';
import boxen from 'boxen';

export class RecoveryEngine {
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
  ) {}

  async recover(errorContext: ErrorContext): Promise<{
    success: boolean;
    result?: any;
    shouldAbort: boolean;
    abortReason?: string;
    error?: string;
  }> {
    if (errorContext.recoveryHistory.length >= this.MAX_ATTEMPTS) {
      return { success: false, shouldAbort: true, abortReason: `Max recovery attempts (${this.MAX_ATTEMPTS}) reached` };
    }
    if (errorContext.browserState.pageFlags.hasCaptcha) {
      return { success: false, shouldAbort: true, abortReason: 'CAPTCHA detected — cannot recover automatically' };
    }
    if (errorContext.error.severity === 'critical') {
      return { success: false, shouldAbort: true, abortReason: 'Critical error — stopping' };
    }

    logger.info('Analyzing error for recovery...');
    this.displayErrorContext(errorContext);

    const plan = await this.getLLMRecoveryPlan(errorContext);
    if (!plan) {
      return { success: false, shouldAbort: false, error: 'No valid recovery plan from LLM' };
    }

    this.displayRecoveryPlan(plan);

    if (plan.shouldAbort) {
      return { success: false, shouldAbort: true, abortReason: plan.abortReason || plan.reasoning };
    }

    const result = await this.executeRecoveryAction(plan, errorContext);

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

    if (result.success) logger.success('Recovery successful');
    else logger.warn(`Recovery failed: ${result.error}`);

    return { success: result.success, result: result.data, shouldAbort: false, error: result.error };
  }

  private async getLLMRecoveryPlan(errorContext: ErrorContext): Promise<RecoveryPlan | null> {
    const RECOVERY_LLM_TIMEOUT = 15000;

    const llmCall = this.llm
      .chat([
        {
          role: 'system',
          content: 'You are a browser automation error recovery specialist. Respond only with valid JSON.',
        },
        { role: 'user', content: RecoveryPromptBuilder.build(errorContext) },
      ])
      .then((response) => {
        const match = response.content.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const plan = JSON.parse(match[0]) as RecoveryPlan;
        return plan.strategy && plan.reasoning ? plan : null;
      })
      .catch(() => null);

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), RECOVERY_LLM_TIMEOUT),
    );

    const plan = await Promise.race([llmCall, timeout]);

    if (plan === null) {
      // LLM timed out or failed — pick a context-aware fallback
      logger.warn('Recovery LLM unavailable — using context-aware fallback');
      const flags = errorContext.browserState.pageFlags;
      if (flags.hasModal || flags.hasOverlay) {
        return {
          strategy: 'dismiss_overlay',
          reasoning: 'Recovery LLM unavailable — a modal/overlay is open, dismissing it before retry',
          confidence: 'low',
          shouldAbort: false,
        } as RecoveryPlan;
      }
      return {
        strategy: 'wait_and_retry',
        reasoning: 'Recovery analysis timed out — retrying original action after a short delay',
        confidence: 'low',
        shouldAbort: false,
        waitBeforeRetry: 2000,
      } as RecoveryPlan;
    }

    return plan;
  }

  private async executeRecoveryAction(
    plan: RecoveryPlan,
    errorContext: ErrorContext,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const registry = getToolRegistry();

    try {
      switch (plan.strategy) {
        case 'wait_and_retry': {
          const wait = plan.waitBeforeRetry || 3000;
          logger.info(`Waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
          const target = plan.action ?? errorContext.failedAction;
          const r = await registry.execute(target.tool, target.params, this.context);
          return { success: r.success, data: r.data, error: r.error };
        }

        case 'refresh_and_retry': {
          logger.info('Refreshing page...');
          await this.context.getBrowserManager().getPage().reload({ waitUntil: 'load' });
          await this.context.getBrowserManager().getPage().waitForTimeout(2000);
          const target = plan.action ?? errorContext.failedAction;
          const r = await registry.execute(target.tool, target.params, this.context);
          return { success: r.success, data: r.data, error: r.error };
        }

        case 'scroll_and_retry': {
          logger.info('Scrolling down...');
          await this.context.getBrowserManager().getPage().evaluate(() => window.scrollBy(0, 400));
          await this.context.getBrowserManager().getPage().waitForTimeout(800);
          const target = plan.action ?? errorContext.failedAction;
          const r = await registry.execute(target.tool, target.params, this.context);
          return { success: r.success, data: r.data, error: r.error };
        }

        case 'dismiss_overlay': {
          logger.info('Dismissing overlay...');
          const page = this.context.getBrowserManager().getPage();
          try {
            await page.getByRole('button', { name: /close|dismiss|accept|got it|no thanks/i })
              .first()
              .click({ timeout: 3000 });
          } catch {
            await page.keyboard.press('Escape');
          }
          await page.waitForTimeout(800);
          const target = plan.action ?? errorContext.failedAction;
          const r = await registry.execute(target.tool, target.params, this.context);
          return { success: r.success, data: r.data, error: r.error };
        }

        case 'navigate_alternative': {
          if (!plan.action) return { success: false, error: 'No alternative URL provided' };
          const r = await registry.execute('navigate', plan.action.params, this.context);
          return { success: r.success, data: r.data, error: r.error };
        }

        case 'abort_with_partial':
          return { success: false, error: 'Stopped with partial results' };

        case 'abort':
        default:
          return { success: false, error: plan.reasoning };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private displayErrorContext(ctx: ErrorContext): void {
    const warnings = [
      ctx.browserState.pageFlags.hasCaptcha && '⚠  CAPTCHA',
      ctx.browserState.pageFlags.hasModal   && '⚠  MODAL OPEN',
      ctx.browserState.pageFlags.hasOverlay && '⚠  OVERLAY PRESENT',
    ].filter(Boolean).join('  ');

    const content = [
      `Type:    ${chalk.red(ctx.error.type)}`,
      `Message: ${ctx.error.message}`,
      '',
      `Tool:    ${chalk.cyan(ctx.failedAction.tool)}`,
      `Params:  ${chalk.gray(JSON.stringify(ctx.failedAction.params))}`,
      '',
      `URL:     ${chalk.gray(ctx.browserState.url)}`,
      warnings ? chalk.yellow(warnings) : '',
    ].filter(Boolean).join('\n');

    console.log('\n' + boxen(content, {
      title: '🔴 ERROR',
      titleAlignment: 'left',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'red',
    }));
  }

  private displayRecoveryPlan(plan: RecoveryPlan): void {
    const content = [
      `Strategy:   ${chalk.cyan(plan.strategy)}`,
      `Confidence: ${plan.confidence}`,
      `Reasoning:  ${plan.reasoning}`,
      plan.action ? `\nAction: ${chalk.cyan(plan.action.tool)} — ${JSON.stringify(plan.action.params)}` : '',
    ].filter(Boolean).join('\n');

    console.log('\n' + boxen(content, {
      title: '💡 RECOVERY PLAN',
      titleAlignment: 'left',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    }));
  }
}
