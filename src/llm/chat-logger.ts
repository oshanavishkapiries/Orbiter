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

  startSession(sessionId: string | null, sessionRepo: any | null): void {
    this.sessionId = sessionId;
    this.sessionRepo = sessionRepo;
    this.callIndex = 0;
    logger.debug(`Chat logger initialized for session: ${sessionId ?? 'no-session'}`);
  }

  async log(
    messages: any[],
    response: LLMInteraction['response'],
    durationMs: number,
  ): Promise<void> {
    this.callIndex++;

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
          Date.now(),
        );
      } catch (err) {
        logger.debug(`LLM interaction DB write failed: ${(err as Error).message}`);
      }
    }
  }

  reset(): void {
    this.callIndex = 0;
    this.sessionId = null;
    this.sessionRepo = null;
  }
}
