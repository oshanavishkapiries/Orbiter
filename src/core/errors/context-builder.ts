import { Page } from 'playwright';
import { logger } from '../../cli/ui/logger.js';
import { generateErrorId } from '../../utils/id.js';
import { ensureDir } from '../../utils/fs.js';
import { PATHS } from '../../utils/paths.js';
import { DomAnalyzer } from '../../browser/dom-analyzer.js';
import { ErrorClassifier } from './classifier.js';
import {
  ErrorContext,
  BrowserStateSnapshot,
  ExecutionSnapshot,
  DomSummary,
} from './types.js';

export class ErrorContextBuilder {
  private domAnalyzer: DomAnalyzer;

  constructor(private page: Page) {
    this.domAnalyzer = new DomAnalyzer(page);
  }

  /**
   * Build complete error context
   */
  async build(
    error: Error,
    failedTool: string,
    failedParams: Record<string, any>,
    attemptNumber: number,
    executionSnapshot: ExecutionSnapshot,
  ): Promise<ErrorContext> {
    logger.debug('Building error context...');

    const errorId = generateErrorId();

    // Classify error
    const { type, severity } = ErrorClassifier.classify(error);

    // Capture browser state
    const browserState = await this.captureBrowserState(errorId);

    // Build context
    const context: ErrorContext = {
      errorId,
      timestamp: Date.now(),

      error: {
        type,
        severity,
        message: this.formatErrorMessage(error, type),
        originalMessage: error.message,
        stack: error.stack,
      },

      failedAction: {
        tool: failedTool,
        params: failedParams,
        selector: failedParams.selector,
        attemptNumber,
      },

      browserState,
      executionState: executionSnapshot,
      recoveryHistory: [],
    };

    logger.debug(`Error context built (id: ${errorId}, type: ${type})`);

    return context;
  }

  /**
   * Capture current browser state
   */
  private async captureBrowserState(
    errorId: string,
  ): Promise<BrowserStateSnapshot> {
    let url = 'unknown';
    let title = 'unknown';
    let domSummary: DomSummary = {
      visibleElements: [],
      clickableElements: [],
      inputFields: [],
      formElements: [],
      iframeCount: 0,
      hasOverlay: false,
      hasModal: false,
      hasCaptcha: false,
    };

    try {
      url = this.page.url();
      title = await this.page.title();
      domSummary = await this.domAnalyzer.analyze();
    } catch (e) {
      logger.debug('Could not get page info for error context');
    }

    // Take screenshot
    const screenshotPath = await this.captureErrorScreenshot(errorId);

    // Get network state
    const networkInfo = await this.domAnalyzer.getNetworkState();
    const scrollPos = await this.domAnalyzer.getScrollPosition();
    const dimensions = await this.domAnalyzer.getPageDimensions();

    return {
      url,
      title,
      domSummary,
      screenshotPath,
      networkState: {
        status: networkInfo.status,
        pendingRequests: networkInfo.pendingRequests,
      },
      scrollPosition: scrollPos,
      pageHeight: dimensions.pageHeight,
      viewportHeight: dimensions.viewportHeight,
    };
  }

  /**
   * Take error screenshot
   */
  private async captureErrorScreenshot(errorId: string): Promise<string> {
    ensureDir(PATHS.errors);

    const screenshotPath = `${PATHS.errors}/error-${errorId}-${Date.now()}.png`;

    try {
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });
      logger.debug(`Error screenshot: ${screenshotPath}`);
    } catch (e) {
      logger.debug('Could not take error screenshot');
    }

    return screenshotPath;
  }

  /**
   * Format user-friendly error message
   */
  private formatErrorMessage(error: Error, type: string): string {
    const messages: Record<string, string> = {
      selector_not_found: `Element not found on page. The selector may be incorrect or the element has not loaded yet.`,
      timeout: `Operation timed out. The page may be slow or the element may not exist.`,
      element_not_interactable: `Element exists but cannot be interacted with. It may be hidden, disabled, or covered by another element.`,
      navigation_failed: `Failed to navigate to the target URL. The page may be unavailable.`,
      network_error: `Network connection issue. Check internet connection or the target site may be down.`,
      element_detached: `Element was removed from the page during execution. The page may have re-rendered.`,
      javascript_error: `JavaScript execution error in browser context.`,
      unknown: error.message,
    };

    return messages[type] || error.message;
  }
}
