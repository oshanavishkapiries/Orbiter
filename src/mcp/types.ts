export interface McpClientOptions {
  headless?: boolean;
  userDataDir?: string | null;
  executablePath?: string | null;
  viewport?: { width: number; height: number };
  browser?: 'chrome' | 'firefox' | 'webkit' | 'msedge';
  outputDir?: string;
}
