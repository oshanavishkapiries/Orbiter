import { logger } from '../../cli/ui/logger.js';
import { generateErrorId } from '../../utils/id.js';
import { ensureDir } from '../../utils/fs.js';
import { PATHS } from '../../utils/paths.js';
import { ErrorClassifier } from './classifier.js';
import { ErrorContext, BrowserStateSnapshot, ExecutionSnapshot, PageFlags } from './types.js';
import type { McpClient } from '../../mcp/client.js';
import { writeFileSync } from 'fs';

export class ErrorContextBuilder {
  constructor(private mcpClient: McpClient) {}

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
      error: { type, severity, message: error.message },
      failedAction: { tool: failedTool, params: failedParams, attemptNumber },
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
      url = await this.mcpClient.getCurrentUrl();
      title = await this.mcpClient.getTitle();

      const snapshotResult = await this.mcpClient.callTool('browser_snapshot', {});
      ariaSnapshot = snapshotResult.message ?? '';

      pageFlags = await this.detectPageFlags();
    } catch {
      logger.debug('Could not capture page state for error context');
    }

    const screenshotPath = await this.takeScreenshot(errorId);
    return { url, title, ariaSnapshot, pageFlags, screenshotPath };
  }

  private async detectPageFlags(): Promise<PageFlags> {
    try {
      return await this.mcpClient.evaluate(`({
        hasModal: !!document.querySelector('[role="dialog"], [aria-modal="true"]'),
        hasOverlay: !!document.querySelector('[class*="overlay"],[class*="cookie"],[class*="consent"],[class*="popup"],[id*="cookie"]'),
        hasCaptcha: !!(document.querySelector('[class*="captcha"],[id*="captcha"]') || document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]')),
      })`);
    } catch {
      return { hasModal: false, hasOverlay: false, hasCaptcha: false };
    }
  }

  private async takeScreenshot(errorId: string): Promise<string> {
    ensureDir(PATHS.errors);
    const path = `${PATHS.errors}/error-${errorId}-${Date.now()}.png`;
    try {
      const result = await this.mcpClient.callTool('browser_screenshot', {});
      if (result.imageBase64) {
        writeFileSync(path, Buffer.from(result.imageBase64, 'base64'));
      }
    } catch {
      logger.debug('Could not take error screenshot');
    }
    return path;
  }
}
