import { LLMProvider } from '../llm/types.js';
import {
  ENHANCER_SYSTEM_PROMPT,
  enhancerUserMessage,
} from '../llm/prompts/enhancer.js';
import { logger } from '../cli/ui/logger.js';

export interface EnhanceResult {
  original: string;
  enhanced: string;
  tokensUsed: number;
}

export class PromptEnhancer {
  constructor(private llm: LLMProvider) {}

  async enhance(rawPrompt: string): Promise<EnhanceResult> {
    logger.debug('Running prompt enhancer...');

    const response = await this.llm.chat([
      { role: 'system', content: ENHANCER_SYSTEM_PROMPT },
      { role: 'user', content: enhancerUserMessage(rawPrompt) },
    ]);

    const enhanced = response.content.trim();

    if (!enhanced) {
      logger.debug('Enhancer returned empty response — using original prompt');
      return { original: rawPrompt, enhanced: rawPrompt, tokensUsed: 0 };
    }

    return {
      original: rawPrompt,
      enhanced,
      tokensUsed: response.usage.totalTokens,
    };
  }
}
