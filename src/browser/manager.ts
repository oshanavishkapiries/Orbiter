import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { generateId } from '../utils/id.js';
import { ensureDir } from '../utils/fs.js';
import { PATHS } from '../utils/paths.js';
import {
  BrowserSession,
  BrowserLaunchOptions,
  NavigationOptions,
  ScreenshotOptions,
} from './types.js';
import { StealthManager } from './stealth.js';

export class BrowserManager {
  private session: BrowserSession | null = null;
  private stealth: StealthManager;

  constructor() {
    this.stealth = new StealthManager();
  }

  /**
   * Launch browser with optional profile
   */
  async launch(options: BrowserLaunchOptions = {}): Promise<BrowserSession> {
    const cfg = config();

    logger.info('Launching browser...');

    const headless = options.headless ?? cfg.browser.headless;
    const viewport = options.viewport ?? cfg.browser.viewport;
    const profilePath = options.profilePath ?? cfg.browser.profilePath;
    const useStealth = options.stealth ?? cfg.browser.stealth;

    let browser: Browser | null = null;
    let context: BrowserContext;
    let page: Page;

    // Launch args
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ];

    // Resolve profile path: explicit config > auto-generated default
    const resolvedProfilePath = profilePath || PATHS.browserProfile;
    ensureDir(resolvedProfilePath);

    if (profilePath) {
      logger.debug(`Using browser profile: ${resolvedProfilePath}`);
    } else {
      logger.debug(`Using default browser profile: ${resolvedProfilePath}`);
    }

    context = await chromium.launchPersistentContext(resolvedProfilePath, {
      headless,
      viewport,
      args,
      ignoreDefaultArgs: ['--enable-automation'],
    });

    page = context.pages()[0] || (await context.newPage());

    // Apply stealth measures
    if (useStealth) {
      await this.stealth.apply(page);
    }

    // Create session
    this.session = {
      id: generateId('session'),
      browser,
      context,
      page,
      startTime: Date.now(),
    };

    logger.success(`Browser launched (session: ${this.session.id})`);

    return this.session;
  }

  /**
   * Get current session
   */
  getSession(): BrowserSession {
    if (!this.session) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.session;
  }

  /**
   * Get current page
   */
  getPage(): Page {
    return this.getSession().page;
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string, options: NavigationOptions = {}): Promise<void> {
    const page = this.getPage();
    const cfg = config();

    const waitUntil = options.waitUntil ?? 'networkidle';
    const timeout = options.timeout ?? cfg.browser.defaultTimeout;

    logger.bullet(`Navigating to: ${url}`);

    try {
      await page.goto(url, {
        waitUntil,
        timeout,
      });

      logger.success(`Navigation complete: ${page.url()}`);
    } catch (error) {
      logger.error(`Navigation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Wait for selector
   */
  async waitForSelector(
    selector: string,
    options: {
      timeout?: number;
      state?: 'attached' | 'detached' | 'visible' | 'hidden';
    } = {},
  ): Promise<void> {
    const page = this.getPage();
    const cfg = config();

    const timeout = options.timeout ?? cfg.browser.defaultTimeout;
    const state = options.state ?? 'visible';

    logger.debug(`Waiting for selector: ${selector}`);

    try {
      await page.waitForSelector(selector, { timeout, state });
      logger.debug(`Selector found: ${selector}`);
    } catch (error) {
      logger.error(`Selector not found: ${selector}`);
      throw error;
    }
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options: NavigationOptions = {}): Promise<void> {
    const page = this.getPage();
    const cfg = config();

    const waitUntil = options.waitUntil ?? 'networkidle';
    const timeout = options.timeout ?? cfg.browser.defaultTimeout;

    await page.waitForLoadState(waitUntil, { timeout });
  }

  /**
   * Take screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    const page = this.getPage();

    const timestamp = Date.now();
    const filename = `screenshot-${timestamp}.png`;
    const screenshotPath =
      options.path || path.join(PATHS.errors, filename);

    ensureDir(path.dirname(screenshotPath));

    await page.screenshot({
      path: screenshotPath,
      fullPage: options.fullPage ?? false,
      type: options.type ?? 'png',
      quality: options.quality,
    });

    logger.debug(`Screenshot saved: ${screenshotPath}`);

    return screenshotPath;
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const page = this.getPage();
    return await page.title();
  }

  /**
   * Get page URL
   */
  getUrl(): string {
    const page = this.getPage();
    return page.url();
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate<T>(
    pageFunction: string | ((...args: any[]) => T | Promise<T>),
    arg?: any,
  ): Promise<T> {
    const page = this.getPage();
    return await page.evaluate(pageFunction, arg);
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (!this.session) {
      return;
    }

    logger.info('Closing browser...');

    try {
      await this.session.page.close();
      await this.session.context.close();

      if (this.session.browser) {
        await this.session.browser.close();
      }

      const duration = Date.now() - this.session.startTime;
      logger.success(
        `Browser closed (session duration: ${(duration / 1000).toFixed(1)}s)`,
      );

      this.session = null;
    } catch (error) {
      logger.error(`Error closing browser: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get realistic user agent
   */
  private async getRealisticUserAgent(): Promise<string> {
    // Use recent Chrome user agent
    const platform = process.platform;

    if (platform === 'darwin') {
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (platform === 'win32') {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else {
      return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
  }

  /**
   * Check if browser is launched
   */
  isLaunched(): boolean {
    return this.session !== null;
  }
}
