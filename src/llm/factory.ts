import { config } from '../config/index.js';
import { LLMProvider } from './types.js';
import { OpenRouterProvider } from './openrouter.js';

export class LLMFactory {
  static create(providerName?: string, model?: string): LLMProvider {
    const cfg = config();
    const provider = providerName || cfg.llm.provider;

    switch (provider) {
      case 'openrouter':
        return new OpenRouterProvider(undefined, model);

      // Future providers
      case 'openai':
        throw new Error('OpenAI provider not yet implemented (Coming in V2)');

      case 'anthropic':
        throw new Error(
          'Anthropic provider not yet implemented (Coming in V2)',
        );

      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }
}
