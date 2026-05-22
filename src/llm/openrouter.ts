import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { BaseLLMProvider } from './interfaces.js';
import { Message, Tool, LLMResponse, ToolCall } from './types.js';
import { fetchModelCapabilities, ModelCapabilities } from './model-capabilities.js';

export class OpenRouterProvider extends BaseLLMProvider {
  name = 'openrouter';
  private client: AxiosInstance;
  private model: string;
  private apiKey: string;
  // Populated by loadCapabilities(); null means "not yet fetched"
  private capabilities: ModelCapabilities | null = null;

  constructor(apiKey?: string, model?: string) {
    super();

    const cfg = config();
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = model || cfg.llm.model;

    if (!this.apiKey) {
      throw new Error(
        'OpenRouter API key not found. Set OPENROUTER_API_KEY environment variable.',
      );
    }

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/orbiter-ai',
        'X-Title': 'Orbiter Browser Automation',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    logger.debug(`OpenRouter provider initialized (model: ${this.model})`);
  }

  supportsFunctionCalling(): boolean {
    return this.capabilities?.supportsFunctions ?? true;
  }

  supportsVision(): boolean {
    const cfg = config();

    // Explicit config override always wins
    if (cfg.llm.vision === 'enabled') return true;
    if (cfg.llm.vision === 'disabled') return false;

    // 'auto': use live API result if available, else fall back to name matching
    if (this.capabilities !== null) {
      return this.capabilities.supportsVision;
    }

    // Fallback: capabilities not yet loaded — use name-based heuristic
    logger.debug('Model capabilities not loaded yet, using name-based detection');
    return isVisionModel(this.model);
  }

  /**
   * Fetch model capabilities from OpenRouter and cache them.
   * Safe to call multiple times — only one API call is made per model.
   */
  async loadCapabilities(): Promise<void> {
    const cfg = config();
    if (cfg.llm.vision === 'enabled' || cfg.llm.vision === 'disabled') {
      // No need to hit the API if user forced a value
      return;
    }

    const caps = await fetchModelCapabilities(this.apiKey, this.model);
    if (caps) {
      this.capabilities = caps;
      logger.debug(
        `[${this.model}] vision=${caps.supportsVision} modality="${caps.modality}" context=${caps.contextLength}`,
      );
    } else {
      logger.debug(
        `Could not load capabilities for "${this.model}" from API — using name-based fallback`,
      );
    }
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse> {
    this.validateTools(tools);

    const cfg = config();

    const payload: any = {
      model: this.model,
      // Pass content as-is: string for text models, ContentPart[] for vision models
      // OpenRouter's API (OpenAI-compatible) handles both formats
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: cfg.llm.temperature,
      max_tokens: cfg.llm.maxTokens,
    };

    // Add tools if provided
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

    try {
      logger.debug(
        `Sending request to OpenRouter (${messages.length} messages, ${tools?.length || 0} tools)`,
      );

      const response = await this.client.post('/chat/completions', payload);

      const choice = response.data.choices[0];
      const usage = response.data.usage;

      // Parse tool calls if present
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

      const result: LLMResponse = {
        content: choice.message.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
      };

      logger.debug(
        `LLM response received (tokens: ${result.usage.totalTokens}, tool_calls: ${toolCalls.length})`,
      );

      return result;
    } catch (error: any) {
      const errorMsg = this.formatError(error);
      logger.error(`OpenRouter API error: ${errorMsg}`);

      if (error.response?.status === 401) {
        throw new Error('Invalid OpenRouter API key');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 402) {
        throw new Error(
          'Insufficient credits. Please add credits to your OpenRouter account.',
        );
      }

      throw new Error(`OpenRouter API error: ${errorMsg}`);
    }
  }

  private mapFinishReason(reason: string): LLMResponse['finishReason'] {
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

  /**
   * Get available models
   */
  async getModels(): Promise<any[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to fetch models: ${this.formatError(error)}`);
      return [];
    }
  }

  /**
   * Get model info
   */
  getModelInfo(): { name: string; provider: string } {
    return {
      name: this.model,
      provider: 'openrouter',
    };
  }
}

/**
 * Detect whether a model ID is known to support vision (image inputs).
 * Covers the major vision-capable model families on OpenRouter.
 */
export function isVisionModel(modelId: string): boolean {
  const id = modelId.toLowerCase();

  // Always vision-capable
  if (id.includes('claude')) return true;           // All Anthropic Claude models
  if (id.includes('gemini')) return true;           // All Google Gemini models
  if (id.includes('gpt-4o')) return true;           // OpenAI GPT-4o family
  if (id.includes('gpt-4-vision')) return true;     // OpenAI GPT-4 Vision
  if (id.includes('gpt-4-turbo')) return true;      // OpenAI GPT-4 Turbo (vision)
  if (id.includes('qwen-vl')) return true;          // Qwen Vision-Language
  if (id.includes('qwen2-vl')) return true;         // Qwen2 VL
  if (id.includes('qwen2.5-vl')) return true;       // Qwen2.5 VL
  if (id.includes('llava')) return true;            // LLaVA models
  if (id.includes('pixtral')) return true;          // Mistral Pixtral
  if (id.includes('grok-2-vision')) return true;    // xAI Grok Vision
  if (id.includes('llama-3.2') && id.includes('vision')) return true;

  // Text-only — explicitly excluded
  // qwen3.x, llama-3.*-instruct (non-vision), mistral-*instruct, etc.
  return false;
}
