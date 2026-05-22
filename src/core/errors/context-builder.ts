import { Page } from 'playwright';
import { logger } from '../../cli/ui/logger.js';
import { generateErrorId } from '../../utils/id.js';
import { ensureDir } from '../../utils/fs.js';
import { PATHS } from '../../utils/paths.js';
import { ErrorClassifier } from './classifier.js';
import { ErrorContext, BrowserStateSnapshot, ExecutionSnapshot, PageFlags } from './types.js';

export class ErrorContextBuilder {
  constructor(private page: Page) {}

  async build(
    error: Error,
    failedTool: string,
    failedParams: Record<string, any>,
    attemptNumber: number,
    executionSnapshot: ExecutionSnapshot,
  ): Promise<ErrorContext> {
    const errorId = generateErrorId();
    const { type, severity } = ErrorClassifier.classify(error);
    const browserState = await this.captureBrowserState(errorId);

    return {
      errorId,
      timestamp: Date.now(),
      error: {
        type,
        severity,
        message: error.message,
      },
      failedAction: {
        tool: failedTool,
        params: failedParams,
        attemptNumber,
      },
      browserState,
      executionState: executionSnapshot,
      recoveryHistory: [],
    };
  }

  private async captureBrowserState(errorId: string): Promise<BrowserStateSnapshot> {
    let url = 'unknown';
    let title = 'unknown';
    let ariaSnapshot = '';
    let pageFlags: PageFlags = { hasModal: false, hasOverlay: false, hasCaptcha: false };

    try {
      url = this.page.url();
      title = await this.page.title();
      ariaSnapshot = await (this.page as any).ariaSnapshot().catch(() => '');
      pageFlags = await this.detectPageFlags();
    } catch {
      logger.debug('Could not capture page state for error context');
    }

    const screenshotPath = await this.takeScreenshot(errorId);

    return { url, title, ariaSnapshot, pageFlags, screenshotPath };
  }

  private async detectPageFlags(): Promise<PageFlags> {
    try {
      return await this.page.evaluate(() => ({
        hasModal: !!document.querySelector('[role="dialog"], [aria-modal="true"]'),
        hasOverlay: !!document.querySelector(
          '[class*="overlay"],[class*="cookie"],[class*="consent"],[class*="popup"],[id*="cookie"]',
        ),
        hasCaptcha: !!(
          document.querySelector('[class*="captcha"],[id*="captcha"]') ||
          document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]')
        ),
      }));
    } catch {
      return { hasModal: false, hasOverlay: false, hasCaptcha: false };
    }
  }

  private async takeScreenshot(errorId: string): Promise<string> {
    ensureDir(PATHS.errors);
    const path = `${PATHS.errors}/error-${errorId}-${Date.now()}.png`;
    try {
      await this.page.screenshot({ path, fullPage: false });
    } catch {
      logger.debug('Could not take error screenshot');
    }
    return path;
  }
}
