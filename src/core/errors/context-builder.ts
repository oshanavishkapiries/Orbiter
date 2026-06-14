import { logger } from '../../cli/ui/logger.js';
import { generateErrorId } from '../../utils/id.js';
import { ErrorClassifier } from './classifier.js';
import {
  ErrorContext,
  BrowserStateSnapshot,
  ExecutionSnapshot,
  PageFlags,
} from './types.js';
import type { McpClient } from '../../mcp/client.js';
import { DataRepository } from '../../memory/database/repositories/data-repository.js';

export class ErrorContextBuilder {
  constructor(
    private mcpClient: McpClient,
    private sessionId: string | null = null,
  ) {}

  async build(
    error: Error,
    failedTool: string,
    failedParams: Record<string, any>,
    attemptNumber: number,
    executionSnapshot: ExecutionSnapshot,
  ): Promise<ErrorContext> {
    const errorId = generateErrorId();
    const { type, severity } = ErrorClassifier.classify(error);
    const browserState = await this.captureBrowserState(errorId, error);

    return {
      errorId,
      timestamp: Date.now(),
      error: { type, severity, message: error.message },
      failedAction: { tool: failedTool, params: failedParams, attemptNumber },
      browserState,
      executionState: executionSnapshot,
      recoveryHistory: [],
    };
  }

  private async captureBrowserState(
    errorId: string,
    error: Error,
  ): Promise<BrowserStateSnapshot> {
    let url = 'unknown';
    let title = 'unknown';
    let ariaSnapshot = '';
    let pageFlags: PageFlags = {
      hasModal: false,
      hasOverlay: false,
      hasCaptcha: false,
    };

    try {
      url = await this.mcpClient.getCurrentUrl();
      title = await this.mcpClient.getTitle();

      const snapshotResult = await this.mcpClient.callTool(
        'browser_snapshot',
        {},
      );
      ariaSnapshot = snapshotResult.message ?? '';

      pageFlags = await this.detectPageFlags();
    } catch {
      logger.debug('Could not capture page state for error context');
    }

    const screenshotPath = await this.takeScreenshot(errorId, url, error);
    return { url, title, ariaSnapshot, pageFlags, screenshotPath };
  }

  private async detectPageFlags(): Promise<PageFlags> {
    try {
      return await this.mcpClient.evaluate(`({
        hasModal: !!document.querySelector('[aria-modal="true"]'),
        hasOverlay: !!(document.querySelector('[class*="cookie"],[class*="consent"],[id*="cookie"],[id*="gdpr"]') && document.querySelector('button')),
        hasCaptcha: !!(document.querySelector('[class*="captcha"],[id*="captcha"]') || document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]')),
      })`);
    } catch {
      return { hasModal: false, hasOverlay: false, hasCaptcha: false };
    }
  }

  private async takeScreenshot(
    errorId: string,
    url: string,
    error: Error,
  ): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('browser_screenshot', {});
      if (result.imageBase64) {
        const repo = new DataRepository();
        await repo.saveErrorCapture(
          errorId,
          this.sessionId,
          (error as any).type ?? null,
          error.message,
          url,
          result.imageBase64,
        );
      }
    } catch {
      logger.debug('Could not save error screenshot');
    }
    return errorId;
  }
}
