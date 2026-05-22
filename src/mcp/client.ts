import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../cli/ui/logger.js';
import type { Tool } from '../llm/types.js';
import type { ToolResult } from '../tools/types.js';
import type { McpClientOptions } from './types.js';

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private mcpTools: Tool[] = [];
  private mcpToolNames = new Set<string>();
  private connected = false;

  async connect(options: McpClientOptions = {}): Promise<void> {
    const args = this.buildArgs(options);

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@latest', ...args],
    });

    this.client = new Client({ name: 'orbiter', version: '1.0.0' });
    await this.client.connect(this.transport);
    this.connected = true;

    const { tools } = await this.client.listTools();
    this.mcpTools = tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      parameters: (t.inputSchema as Tool['parameters']) ?? {
        type: 'object',
        properties: {},
      },
    }));
    this.mcpToolNames = new Set(this.mcpTools.map((t) => t.name));

    logger.debug(`MCP connected — ${this.mcpTools.length} Playwright tools available`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // ignore close errors on shutdown
      }
      this.client = null;
      this.connected = false;
    }
  }

  getTools(): Tool[] {
    return this.mcpTools;
  }

  isMcpTool(name: string): boolean {
    return this.mcpToolNames.has(name);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callTool(name: string, params: Record<string, any>): Promise<ToolResult> {
    if (!this.client) {
      return { success: false, error: 'MCP client not connected' };
    }

    try {
      const raw = await this.client.callTool({ name, arguments: params });
      return this.convertResult(raw);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async evaluate(expression: string): Promise<any> {
    const result = await this.callTool('browser_evaluate', { function: expression });
    if (!result.success) throw new Error(result.error ?? 'Evaluate failed');
    const text = result.data ?? result.message ?? '';
    return this.parseMcpValue(text);
  }

  private parseMcpValue(text: string): any {
    // MCP browser_evaluate returns: "### Result\n<json>\n### Ran Playwright code\n..."
    const resultMatch = text.match(/###\s*Result\s*\n([\s\S]*?)(?:\n###|$)/);
    const raw = resultMatch ? resultMatch[1].trim() : text.trim();
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async getCurrentUrl(): Promise<string> {
    try {
      const url = await this.evaluate('window.location.href');
      return typeof url === 'string' ? url : '';
    } catch {
      return '';
    }
  }

  async getTitle(): Promise<string> {
    try {
      const title = await this.evaluate('document.title');
      return typeof title === 'string' ? title : '';
    } catch {
      return '';
    }
  }

  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildArgs(options: McpClientOptions): string[] {
    const args: string[] = [];

    if (options.headless) args.push('--headless');
    if (options.userDataDir) args.push('--user-data-dir', options.userDataDir);
    if (options.executablePath) args.push('--executable-path', options.executablePath);
    if (options.browser) args.push('--browser', options.browser);
    if (options.viewport) {
      args.push('--viewport-size', `${options.viewport.width}x${options.viewport.height}`);
    }
    if (options.outputDir) args.push('--output-dir', options.outputDir);

    return args;
  }

  private convertResult(raw: any): ToolResult {
    const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> =
      raw?.content ?? [];

    if (raw?.isError) {
      const errorText = content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n') || 'Tool execution failed';
      return { success: false, error: errorText };
    }

    const textParts = content.filter((c) => c.type === 'text').map((c) => c.text ?? '');
    const textContent = textParts.join('\n');

    const imageItem = content.find((c) => c.type === 'image');

    return {
      success: true,
      message: textContent,
      data: textContent,
      ...(imageItem?.data ? { imageBase64: imageItem.data } : {}),
    };
  }
}
