import fs from 'fs';
import path from 'path';
import { logger } from '../cli/ui/logger.js';

export interface LLMInteraction {
  timestamp: number;
  sessionId: string | null;
  callIndex: number;
  messages: any[];
  response: {
    content: string;
    toolCalls?: any[];
    finishReason: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  };
  durationMs: number;
}

export class ChatLogger {
  private static _instance: ChatLogger | null = null;
  private logPath: string | null = null;
  private callIndex = 0;
  private sessionId: string | null = null;
  // Lazy import to avoid circular dependency: executor → chat-logger → session-repo → executor
  private sessionRepo: any = null;

  private constructor() {}

  static getInstance(): ChatLogger {
    if (!ChatLogger._instance) {
      ChatLogger._instance = new ChatLogger();
    }
    return ChatLogger._instance;
  }

  startSession(
    sessionId: string | null,
    sessionRepo: any | null,
    logDir = './data/logs',
  ): void {
    this.sessionId = sessionId;
    this.sessionRepo = sessionRepo;
    this.callIndex = 0;

    const filename = sessionId
      ? `llm-chat-${sessionId}.jsonl`
      : `llm-chat-${Date.now()}.jsonl`;

    const resolvedDir = path.resolve(logDir);
    fs.mkdirSync(resolvedDir, { recursive: true });
    this.logPath = path.join(resolvedDir, filename);

    logger.debug(`Chat log: ${this.logPath}`);
  }

  async log(
    messages: any[],
    response: LLMInteraction['response'],
    durationMs: number,
  ): Promise<void> {
    this.callIndex++;

    const entry: LLMInteraction = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      callIndex: this.callIndex,
      messages,
      response,
      durationMs,
    };

    // Write to JSONL log file
    if (this.logPath) {
      try {
        fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
      } catch (err) {
        logger.debug(`Chat log write failed: ${(err as Error).message}`);
      }
    }

    // Persist to DB (non-fatal)
    if (this.sessionRepo && this.sessionId) {
      try {
        await this.sessionRepo.storeLLMInteraction(
          this.sessionId,
          this.callIndex,
          messages,
          response.content,
          response.toolCalls ?? null,
          response.finishReason,
          response.usage.promptTokens,
          response.usage.completionTokens,
          response.usage.totalTokens,
          durationMs,
          entry.timestamp,
        );
      } catch (err) {
        logger.debug(`LLM interaction DB write failed: ${(err as Error).message}`);
      }
    }
  }

  getLogPath(): string | null {
    return this.logPath;
  }

  reset(): void {
    this.logPath = null;
    this.callIndex = 0;
    this.sessionId = null;
    this.sessionRepo = null;
  }
}
