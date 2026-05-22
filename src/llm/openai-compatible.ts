import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { BaseLLMProvider } from './interfaces.js';
import { ChatLogger } from './chat-logger.js';
import { LLMResponse, Message, Tool, ToolCall } from './types.js';

export interface OpenAICompatibleProviderOptions {
  providerName: string;
  model: string;
  apiKey: string;
  baseURL: string;
  title: string;
  referer?: string;
  timeout?: number;
}

export abstract class OpenAICompatibleProvider extends BaseLLMProvider {
  name: string;
  protected client: AxiosInstance;
  protected model: string;
  protected apiKey: string;

  constructor(options: OpenAICompatibleProviderOptions) {
    super();

    this.name = options.providerName;
    this.model = options.model;
    this.apiKey = options.apiKey;

    this.client = axios.create({
      baseURL: options.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.referer ? { 'HTTP-Referer': options.referer } : {}),
        'X-Title': options.title,
        'Content-Type': 'application/json',
      },
      timeout: options.timeout ?? 60000,
    });

    logger.debug(
      `${options.providerName} provider initialized (model: ${this.model})`,
    );
  }

  supportsFunctionCalling(): boolean {
    return true;
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse> {
    this.validateTools(tools);

    const cfg = config();
    const callStart = Date.now();
    const payload: any = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: 'function',
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.arguments),
                },
              })),
            }
          : {}),
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: cfg.llm.temperature,
      max_tokens: cfg.llm.maxTokens,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.debug(
          `Sending request to ${this.name} (${messages.length} messages, ${tools?.length || 0} tools, attempt ${attempt})`,
        );

        const response = await this.client.post('/chat/completions', payload);
        const result = this.parseChatResponse(response.data);

        logger.debug(
          `LLM response received (tokens: ${result.usage.totalTokens}, tool_calls: ${result.toolCalls?.length || 0})`,
        );

        const durationMs = Date.now() - callStart;
        ChatLogger.getInstance()
          .log(
            messages,
            {
              content: result.content,
              toolCalls: result.toolCalls,
              finishReason: result.finishReason,
              usage: result.usage,
            },
            durationMs,
          )
          .catch(() => {});

        return result;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;

        if (
          attempt < MAX_RETRIES &&
          (status === 429 || (status >= 500 && status < 600))
        ) {
          const delayMs = Math.pow(2, attempt) * 1000;
          logger.warn(
            `${this.name} API ${status}, retrying in ${delayMs / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        break;
      }
    }

    throw this.mapProviderError(lastError);
  }

  protected parseChatResponse(data: any): LLMResponse {
    const choice = data.choices[0];
    const usage = data.usage;

    const toolCalls: ToolCall[] = [];
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content:
        typeof choice.message.content === 'string' ? choice.message.content : '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    };
  }

  protected mapProviderError(error: any): Error {
    const errorMsg = this.formatError(error);
    const status = error?.response?.status;
    logger.error(`${this.name} API error: ${errorMsg}`);

    if (status === 401) {
      return new Error(`Invalid ${this.name} API key`);
    }
    if (status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (status === 402) {
      return new Error('Insufficient credits. Please add credits to your account.');
    }

    return new Error(`${this.name} API error: ${errorMsg}`);
  }

  protected mapFinishReason(reason: string): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'error';
    }
  }

  getModelInfo(): { name: string; provider: string } {
    return {
      name: this.model,
      provider: this.name,
    };
  }
}
