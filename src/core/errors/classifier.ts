import { ErrorType, ErrorSeverity } from './types.js';

export class ErrorClassifier {
  /**
   * Classify error type from error message
   */
  static classify(error: Error): {
    type: ErrorType;
    severity: ErrorSeverity;
  } {
    const message = error.message.toLowerCase();

    // Selector not found
    if (
      message.includes('selector') ||
      message.includes('element not found') ||
      message.includes('no element') ||
      message.includes('waiting for locator') ||
      message.includes('unable to find')
    ) {
      return {
        type: 'selector_not_found',
        severity: 'medium',
      };
    }

    // Timeout
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('exceeded')
    ) {
      return {
        type: 'timeout',
        severity: 'medium',
      };
    }

    // Element not interactable
    if (
      message.includes('not interactable') ||
      message.includes('intercepts pointer') ||
      message.includes('element is not visible') ||
      message.includes('element is hidden') ||
      message.includes('not attached')
    ) {
      return {
        type: 'element_not_interactable',
        severity: 'medium',
      };
    }

    // Element detached
    if (
      message.includes('detached') ||
      message.includes('stale') ||
      message.includes('no longer exists')
    ) {
      return {
        type: 'element_detached',
        severity: 'low',
      };
    }

    // Navigation failed
    if (
      message.includes('navigation') ||
      message.includes('net::err') ||
      message.includes('failed to navigate') ||
      message.includes('page crashed')
    ) {
      return {
        type: 'navigation_failed',
        severity: 'high',
      };
    }

    // Network error
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('dns') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return {
        type: 'network_error',
        severity: 'high',
      };
    }

    // JavaScript error
    if (
      message.includes('execution context') ||
      message.includes('runtime.callfunction') ||
      message.includes('cannot read') ||
      message.includes('is not a function')
    ) {
      return {
        type: 'javascript_error',
        severity: 'medium',
      };
    }

    return {
      type: 'unknown',
      severity: 'medium',
    };
  }

  /**
   * Detect special page conditions
   */
  static detectPageConditions(domSummary: any): {
    hasCaptcha: boolean;
    hasLoginWall: boolean;
    hasRateLimit: boolean;
    hasModal: boolean;
    hasOverlay: boolean;
  } {
    const allText = JSON.stringify(domSummary).toLowerCase();

    return {
      hasCaptcha:
        allText.includes('captcha') ||
        allText.includes('recaptcha') ||
        allText.includes('hcaptcha') ||
        allText.includes('cf-challenge'),

      hasLoginWall:
        allText.includes('sign in') ||
        allText.includes('log in') ||
        allText.includes('login required') ||
        allText.includes('please login'),

      hasRateLimit:
        allText.includes('rate limit') ||
        allText.includes('too many requests') ||
        allText.includes('429') ||
        allText.includes('slow down'),

      hasModal:
        allText.includes('[role="dialog"]') ||
        allText.includes('.modal') ||
        allText.includes('#modal') ||
        allText.includes('dialog'),

      hasOverlay:
        allText.includes('overlay') ||
        allText.includes('popup') ||
        allText.includes('cookie-banner') ||
        allText.includes('cookie-consent'),
    };
  }
}
