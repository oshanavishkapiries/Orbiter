import { ErrorType, ErrorSeverity } from './types.js';

export class ErrorClassifier {
  static classify(error: Error): { type: ErrorType; severity: ErrorSeverity } {
    const msg = error.message.toLowerCase();

    if (
      msg.includes('captcha') ||
      msg.includes('recaptcha') ||
      msg.includes('cf-challenge')
    ) {
      return { type: 'captcha_detected', severity: 'critical' };
    }
    if (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('waiting for') ||
      msg.includes('exceeded')
    ) {
      return { type: 'timeout', severity: 'medium' };
    }
    if (
      msg.includes('no containers matched') ||
      msg.includes('no data extracted') ||
      msg.includes('selectors returned null') ||
      msg.includes('matched the containerselector') ||
      msg.includes('matched the selector') ||
      msg.includes('extractfn returned no items')
    ) {
      return { type: 'selector_mismatch', severity: 'low' };
    }
    if (
      msg.includes('not found') ||
      msg.includes('no element') ||
      msg.includes('unable to find') ||
      msg.includes('strict mode violation') ||
      msg.includes('locator')
    ) {
      return { type: 'element_not_found', severity: 'medium' };
    }
    if (
      msg.includes('not interactable') ||
      msg.includes('intercepts pointer') ||
      msg.includes('not visible') ||
      msg.includes('hidden') ||
      msg.includes('not attached')
    ) {
      return { type: 'element_not_interactable', severity: 'medium' };
    }
    if (
      msg.includes('detached') ||
      msg.includes('stale') ||
      msg.includes('no longer exists')
    ) {
      return { type: 'element_detached', severity: 'low' };
    }
    if (
      msg.includes('navigation') ||
      msg.includes('net::err') ||
      msg.includes('failed to navigate') ||
      msg.includes('page crashed')
    ) {
      return { type: 'navigation_failed', severity: 'high' };
    }
    if (
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('dns') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return { type: 'network_error', severity: 'high' };
    }
    if (
      msg.includes('execution context') ||
      msg.includes('cannot read') ||
      msg.includes('is not a function')
    ) {
      return { type: 'javascript_error', severity: 'medium' };
    }

    return { type: 'unknown', severity: 'medium' };
  }
}
