import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import {
  fetchModelCapabilities,
  ModelCapabilities,
} from './model-capabilities.js';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  name = 'openrouter';
  // Populated by loadCapabilities(); null means "not yet fetched"
  private capabilities: ModelCapabilities | null = null;

  constructor(apiKey?: string, model?: string, cfg?: any) {
    const activeCfg = cfg || config();
    const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    const resolvedModel = model || activeCfg.llm.model;

    if (!resolvedApiKey) {
      throw new Error(
        'OpenRouter API key not found. Set OPENROUTER_API_KEY environment variable.',
      );
    }

    super({
      providerName: 'openrouter',
      model: resolvedModel,
      apiKey: resolvedApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      referer: 'https://github.com/orbiter-ai',
      title: 'Orbiter Browser Automation',
      config: activeCfg,
    });
  }

  supportsFunctionCalling(): boolean {
    return this.capabilities?.supportsFunctions ?? true;
  }

  supportsVision(): boolean {
    const cfg = this.config || config();

    // Explicit config override always wins
    if (cfg.llm.vision === 'enabled') return true;
    if (cfg.llm.vision === 'disabled') return false;

    // 'auto': use live API result if available, else fall back to name matching
    if (this.capabilities !== null) {
      return this.capabilities.supportsVision;
    }

    // Fallback: capabilities not yet loaded — use name-based heuristic
    logger.debug(
      'Model capabilities not loaded yet, using name-based detection',
    );
    return isVisionModel(this.model);
  }

  /**
   * Fetch model capabilities from OpenRouter and cache them.
   * Safe to call multiple times — only one API call is made per model.
   */
  async loadCapabilities(): Promise<void> {
    const cfg = this.config || config();
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

  getCapabilities(): ModelCapabilities | null {
    return this.capabilities;
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
  protected override mapProviderError(error: any): Error {
    const status = error?.response?.status;
    if (status === 402) {
      logger.error(`OpenRouter API error: ${this.formatError(error)}`);
      return new Error(
        'Insufficient credits. Please add credits to your OpenRouter account.',
      );
    }

    return super.mapProviderError(error);
  }
}

/**
 * Detect whether a model ID is known to support vision (image inputs).
 * Covers the major vision-capable model families on OpenRouter.
 */
export function isVisionModel(modelId: string): boolean {
  const id = modelId.toLowerCase();

  // Always vision-capable
  if (id.includes('claude')) return true; // All Anthropic Claude models
  if (id.includes('gemini')) return true; // All Google Gemini models
  if (id.includes('gpt-4o')) return true; // OpenAI GPT-4o family
  if (id.includes('gpt-4-vision')) return true; // OpenAI GPT-4 Vision
  if (id.includes('gpt-4-turbo')) return true; // OpenAI GPT-4 Turbo (vision)
  if (id.includes('qwen-vl')) return true; // Qwen Vision-Language
  if (id.includes('qwen2-vl')) return true; // Qwen2 VL
  if (id.includes('qwen2.5-vl')) return true; // Qwen2.5 VL
  if (id.includes('llava')) return true; // LLaVA models
  if (id.includes('pixtral')) return true; // Mistral Pixtral
  if (id.includes('grok-2-vision')) return true; // xAI Grok Vision
  if (id.includes('llama-3.2') && id.includes('vision')) return true;

  // Text-only — explicitly excluded
  // qwen3.x, llama-3.*-instruct (non-vision), mistral-*instruct, etc.
  return false;
}
