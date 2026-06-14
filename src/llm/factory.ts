import { config } from '../config/index.js';
import { LLMProvider } from './types.js';
import { OpenRouterProvider } from './openrouter.js';
import { OpenCodeGoProvider } from './opencode-go.js';

export class LLMFactory {
  static create(providerName?: string, model?: string, cfg?: any): LLMProvider {
    const activeCfg = cfg || config();
    const provider = providerName || activeCfg.llm.provider;

    switch (provider) {
      case 'openrouter':
        return new OpenRouterProvider(undefined, model, activeCfg);

      case 'opencode-go':
        return new OpenCodeGoProvider(undefined, model, activeCfg);

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
