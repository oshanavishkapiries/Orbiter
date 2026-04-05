import { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserProfile {
  name: string;
  path: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezone?: string;
}

export interface BrowserLaunchOptions {
  headless?: boolean;
  profilePath?: string;
  profileName?: string;
  stealth?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface BrowserSession {
  id: string;
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  profile?: BrowserProfile;
  startTime: number;
}

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
}
