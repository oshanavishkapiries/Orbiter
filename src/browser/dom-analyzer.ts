import { Page } from 'playwright';
import { logger } from '../cli/ui/logger.js';
import { DomSummary } from '../core/errors/types.js';

export class DomAnalyzer {
  constructor(private page: Page) {}

  /**
   * Capture full DOM summary for error context
   */
  async analyze(): Promise<DomSummary> {
    try {
      const summary = await this.page.evaluate(() => {
        const results = {
          visibleElements: [] as string[],
          clickableElements: [] as string[],
          inputFields: [] as string[],
          formElements: [] as string[],
          iframeCount: 0,
          hasOverlay: false,
          hasModal: false,
          hasCaptcha: false,
        };

        // Helper: generate clean selector
        function getSelector(el: Element): string {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';

          if (id) return `${tag}${id}`;

          const dataTestId = el.getAttribute('data-testid');
          if (dataTestId) return `${tag}[data-testid="${dataTestId}"]`;

          const name = el.getAttribute('name');
          if (name) return `${tag}[name="${name}"]`;

          const role = el.getAttribute('role');
          if (role) return `${tag}[role="${role}"]`;

          const classes = Array.from(el.classList)
            .filter(c => !c.match(/^(is-|has-|active|focus)/))
            .slice(0, 2)
            .join('.');

          return classes ? `${tag}.${classes}` : tag;
        }

        // Helper: is element visible
        function isVisible(el: Element): boolean {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
          );
        }

        // Count iframes
        results.iframeCount = document.querySelectorAll('iframe').length;

        // Check for captcha
        results.hasCaptcha =
          !!document.querySelector('[class*="captcha"]') ||
          !!document.querySelector('[id*="captcha"]') ||
          !!document.querySelector('iframe[src*="recaptcha"]') ||
          !!document.querySelector('iframe[src*="hcaptcha"]');

        // Check for modal
        results.hasModal =
          !!document.querySelector('[role="dialog"]') ||
          !!document.querySelector('.modal.show') ||
          !!document.querySelector('.modal-open');

        // Check for overlay
        const overlaySelectors = [
          '[class*="overlay"]',
          '[class*="cookie"]',
          '[id*="cookie"]',
          '[class*="consent"]',
          '[class*="popup"]',
        ];
        results.hasOverlay = overlaySelectors.some(
          s => !!document.querySelector(s)
        );

        // Analyze all elements
        const allElements = document.querySelectorAll('*');

        allElements.forEach(el => {
          if (!isVisible(el)) return;

          const selector = getSelector(el);
          const tag = el.tagName.toLowerCase();
          const text = el.textContent?.trim().slice(0, 50) || '';

          // Visible elements (top 30)
          if (results.visibleElements.length < 30) {
            results.visibleElements.push(
              text ? `${selector} ("${text}")` : selector
            );
          }

          // Clickable elements (buttons, links)
          if (
            results.clickableElements.length < 20 &&
            (tag === 'button' ||
              tag === 'a' ||
              el.getAttribute('role') === 'button' ||
              el.getAttribute('onclick') !== null ||
              el.getAttribute('type') === 'submit')
          ) {
            const label =
              el.getAttribute('aria-label') ||
              el.getAttribute('title') ||
              text ||
              '';
            results.clickableElements.push(
              `${selector}${label ? ` ("${label}")` : ''}`
            );
          }

          // Input fields
          if (
            results.inputFields.length < 15 &&
            (tag === 'input' ||
              tag === 'textarea' ||
              tag === 'select' ||
              el.getAttribute('contenteditable') === 'true')
          ) {
            const type = el.getAttribute('type') || tag;
            const placeholder = el.getAttribute('placeholder') || '';
            const label =
              el.getAttribute('aria-label') || el.getAttribute('name') || '';
            results.inputFields.push(
              `${selector} [${type}]${label ? ` ("${label}")` : ''}${placeholder ? ` placeholder="${placeholder}"` : ''}`
            );
          }

          // Form elements
          if (results.formElements.length < 10 && tag === 'form') {
            const action = el.getAttribute('action') || '';
            results.formElements.push(
              `form${action ? `[action="${action}"]` : ''}`
            );
          }
        });

        return results;
      });

      return summary;
    } catch (error) {
      logger.debug(`DOM analysis failed: ${(error as Error).message}`);

      // Return empty summary on failure
      return {
        visibleElements: [],
        clickableElements: [],
        inputFields: [],
        formElements: [],
        iframeCount: 0,
        hasOverlay: false,
        hasModal: false,
        hasCaptcha: false,
      };
    }
  }

  /**
   * Get network state
   */
  async getNetworkState(): Promise<{
    status: 'online' | 'slow' | 'offline';
    pendingRequests: number;
  }> {
    try {
      const isOnline = await this.page.evaluate(() => navigator.onLine);
      return {
        status: isOnline ? 'online' : 'offline',
        pendingRequests: 0,
      };
    } catch {
      return { status: 'online', pendingRequests: 0 };
    }
  }

  /**
   * Get scroll position
   */
  async getScrollPosition(): Promise<{ x: number; y: number }> {
    try {
      return await this.page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));
    } catch {
      return { x: 0, y: 0 };
    }
  }

  /**
   * Get page dimensions
   */
  async getPageDimensions(): Promise<{
    pageHeight: number;
    viewportHeight: number;
  }> {
    try {
      return await this.page.evaluate(() => ({
        pageHeight: document.body.scrollHeight,
        viewportHeight: window.innerHeight,
      }));
    } catch {
      return { pageHeight: 0, viewportHeight: 0 };
    }
  }
}