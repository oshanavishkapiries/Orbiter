import { Page } from 'playwright';
import { logger } from '../cli/ui/logger.js';

export class StealthManager {
  /**
   * Apply stealth measures to page
   */
  async apply(page: Page): Promise<void> {
    logger.debug('Applying stealth measures...');

    // Override navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Override permissions
    await page.addInitScript(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: 'denied' } as PermissionStatus)
          : originalQuery(parameters);
    });

    // Override plugins
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: Plugin,
            },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
          },
        ],
      });
    });

    // Override languages
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Chrome specific properties
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    // Randomize canvas fingerprint slightly
    await page.addInitScript(() => {
      const getImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        const imageData = getImageData.apply(this, args as any);
        // Add minimal noise
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = imageData.data[i] + Math.random() * 0.1;
        }
        return imageData;
      };
    });

    logger.debug('Stealth measures applied');
  }

  /**
   * Test stealth effectiveness
   */
  async test(page: Page): Promise<Record<string, any>> {
    const results = await page.evaluate(() => {
      return {
        webdriver: navigator.webdriver,
        plugins: navigator.plugins.length,
        languages: navigator.languages,
        platform: navigator.platform,
        chrome: !!(window as any).chrome,
        permissions: navigator.permissions ? 'present' : 'missing',
      };
    });

    logger.debug('Stealth test results:', results);
    return results;
  }
}