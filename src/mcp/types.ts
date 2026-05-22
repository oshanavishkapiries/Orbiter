export interface McpClientOptions {
  headless?: boolean;
  userDataDir?: string | null;
  executablePath?: string | null;
  viewport?: { width: number; height: number };
  browser?: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'msedge';
  outputDir?: string;
}
