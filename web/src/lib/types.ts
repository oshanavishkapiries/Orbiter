export interface Session {
  id: string;
  goal: string;
  model?: string;
  provider?: string;
  status: 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface Step {
  stepNumber: number;
  toolName: string;
  params: Record<string, unknown>;
  resultSummary: string;
  success: boolean;
  duration?: number;
  createdAt: number;
}

export interface LLMInteraction {
  id: number;
  sessionId: string;
  callIndex: number;
  fullMessages: ChatMessage[];
  responseContent: string | null;
  toolCalls: ToolCall[] | null;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  timestamp: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CollectedData {
  stepNumber: number;
  toolName: string;
  data: unknown;
  createdAt: number;
}

export interface FlowFile {
  name: string;
  path: string;
  type: 'raw' | 'refined';
  sizeBytes: number;
  modifiedAt: number;
  stepCount?: number;
}

export interface MemorySelector {
  id: string;
  domain: string;
  elementName: string;
  elementType: string;
  primarySelector: string;
  confidence: number;
  usageCount: number;
  successCount: number;
  createdAt: number;
}

export interface Stats {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  successRate: number;
  totalTokens: number;
  flowsCount: number;
  activeSessions: number;
}
