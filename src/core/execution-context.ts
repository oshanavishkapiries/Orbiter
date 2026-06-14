import { McpClient } from '../mcp/client.js';
import { logger } from '../cli/ui/logger.js';
import type { LLMProvider } from '../llm/types.js';
import type { SessionRepository } from '../memory/database/repositories/session-repository.js';

export interface ExecutionState {
  currentStep: number;
  totalSteps: number;
  startTime: number;
  collectedData: Record<string, any>;
  history: ExecutionHistoryItem[];
}

export interface ExecutionHistoryItem {
  step: number;
  action: string;
  target?: string;
  result: 'success' | 'failed';
  error?: string;
  timestamp: number;
  duration: number;
}

export class ExecutionContext {
  private mcpClient: McpClient | null = null;
  private state: ExecutionState;
  private llm: LLMProvider | null = null;
  private sessionRepo: SessionRepository | null = null;
  private sessionId: string | null = null;

  constructor() {
    this.state = {
      currentStep: 0,
      totalSteps: 0,
      startTime: Date.now(),
      collectedData: {},
      history: [],
    };
  }

  setMcpClient(client: McpClient): void {
    this.mcpClient = client;
  }

  getMcpClient(): McpClient {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized — call setMcpClient() first');
    }
    return this.mcpClient;
  }

  setLLM(llm: LLMProvider): void {
    this.llm = llm;
  }

  getLLM(): LLMProvider | null {
    return this.llm;
  }

  setSession(repo: SessionRepository, sessionId: string): void {
    this.sessionRepo = repo;
    this.sessionId = sessionId;
  }

  getSessionRepo(): SessionRepository | null {
    return this.sessionRepo;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getState(): ExecutionState {
    return this.state;
  }

  setTotalSteps(total: number): void {
    this.state.totalSteps = total;
  }

  recordStep(
    action: string,
    target: string | undefined,
    result: 'success' | 'failed',
    error?: string,
  ): void {
    const now = Date.now();
    const lastTimestamp =
      this.state.history.length > 0
        ? this.state.history[this.state.history.length - 1].timestamp
        : this.state.startTime;

    this.state.history.push({
      step: this.state.currentStep,
      action,
      target,
      result,
      error,
      timestamp: now,
      duration: now - lastTimestamp,
    });

    this.state.currentStep++;
  }

  storeData(key: string, value: any): void {
    this.state.collectedData[key] = value;
  }

  getData(key: string): any {
    return this.state.collectedData[key];
  }

  getLastSuccessfulSteps(n: number): ExecutionHistoryItem[] {
    return this.state.history.filter((item) => item.result === 'success').slice(-n);
  }

  getSummary(): { totalSteps: number; successfulSteps: number; failedSteps: number; duration: number } {
    const successful = this.state.history.filter((h) => h.result === 'success').length;
    const failed = this.state.history.filter((h) => h.result === 'failed').length;
    return {
      totalSteps: this.state.history.length,
      successfulSteps: successful,
      failedSteps: failed,
      duration: Date.now() - this.state.startTime,
    };
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up execution context...');
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }
    logger.success('Execution context cleaned up');
  }
}
