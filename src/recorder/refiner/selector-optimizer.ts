import { logger } from '../../cli/ui/logger.js';
import { SelectorSuggestion } from './types.js';

export class SelectorOptimizer {
  /**
   * Analyze selector and suggest more stable alternatives
   */
  analyze(selector: string): SelectorSuggestion {
    const stability = this.assessStability(selector);
    const suggestion = this.suggestBetter(selector);

    return {
      original: selector,
      suggested: suggestion || selector,
      reason: this.explainSuggestion(selector, stability),
      stability,
    };
  }

  /**
   * Assess how stable a selector is
   */
  private assessStability(selector: string): 'high' | 'medium' | 'low' {
    // High stability indicators
    if (
      selector.includes('[data-testid=') ||
      selector.includes('[data-cy=') ||
      selector.includes('[data-id=') ||
      selector.includes('[aria-label=') ||
      selector.includes('[name=') ||
      selector.match(/^#[a-zA-Z][\w-]+$/) // Simple ID
    ) {
      return 'high';
    }

    // Low stability indicators
    if (
      selector.includes(':nth-child') ||
      selector.includes(':nth-of-type') ||
      selector.split('>').length > 3 || // Deep nesting
      selector.split(' ').length > 4 || // Too many parts
      selector.match(/\.[a-z]{1,2}\b/) || // Very short class names
      selector.includes('css-') || // CSS-in-JS generated
      selector.includes('sc-') || // Styled components
      selector.match(/[A-Z]{3,}/) // Likely generated
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Suggest a more stable selector
   */
  private suggestBetter(selector: string): string | null {
    // Already good - no suggestion needed
    if (
      selector.includes('[data-testid=') ||
      selector.includes('[aria-label=') ||
      selector.match(/^#[a-zA-Z][\w-]+$/)
    ) {
      return null;
    }

    // Clean up CSS-in-JS class names
    if (selector.match(/\.(css|sc|styled)-[a-zA-Z0-9]+/)) {
      return selector.replace(/\.(css|sc|styled)-[a-zA-Z0-9]+/g, '').trim();
    }

    // Simplify deep nesting
    if (selector.split('>').length > 3) {
      const parts = selector.split('>');
      return parts[parts.length - 1].trim();
    }

    return null;
  }

  /**
   * Explain why we're suggesting a change
   */
  private explainSuggestion(selector: string, stability: string): string {
    if (stability === 'high') {
      return 'Selector is already stable';
    }

    if (selector.includes(':nth-child')) {
      return 'nth-child selectors break when page structure changes';
    }

    if (selector.split('>').length > 3) {
      return 'Deep nesting makes selector fragile to structure changes';
    }

    if (selector.match(/\.(css|sc|styled)-[a-zA-Z0-9]+/)) {
      return 'CSS-in-JS class names change on rebuild';
    }

    return 'Selector may be brittle - consider using data-testid or aria-label';
  }

  /**
   * Build fallback selector chain from error recovery data
   */
  buildFallbackChain(primary: string, recoverySelectors: string[]): string[] {
    const chain = [primary];

    for (const sel of recoverySelectors) {
      if (sel && sel !== primary && !chain.includes(sel)) {
        chain.push(sel);
      }
    }

    return chain;
  }

  /**
   * Extract recovery selectors from flow step
   */
  extractRecoverySelectors(step: any): string[] {
    const selectors: string[] = [];

    if (!step.recoveryAttempts) return selectors;

    for (const attempt of step.recoveryAttempts) {
      if (attempt.newSelector && attempt.result === 'success') {
        selectors.push(attempt.newSelector);
      }
      if (attempt.action?.params?.selector) {
        selectors.push(attempt.action.params.selector);
      }
    }

    return selectors;
  }
}
