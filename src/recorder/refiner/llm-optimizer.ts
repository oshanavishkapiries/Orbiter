import { LLMProvider } from '../../llm/types.js';
import { FlowStep } from '../schema.js';
import { OptimizedStep } from './types.js';
import { logger } from '../../cli/ui/logger.js';

export class LLMFlowOptimizer {
  constructor(private llm: LLMProvider) {}

  /**
   * Optimize flow using LLM
   */
  async optimize(
    steps: FlowStep[],
    originalGoal: string,
  ): Promise<{
    optimizedSteps: OptimizedStep[];
    suggestions: string[];
    tokenUsed: number;
  }> {
    logger.info('Sending flow to LLM for optimization...');

    const prompt = this.buildOptimizationPrompt(steps, originalGoal);

    try {
      const response = await this.llm.chat([
        {
          role: 'system',
          content: `You are a browser automation flow optimizer.
Your job is to analyze recorded browser automation flows and:
1. Remove unnecessary steps
2. Improve CSS selectors for stability
3. Add fallback selectors from error recovery data
4. Suggest better waiting strategies
5. Combine steps where possible

Always return valid JSON. Be conservative - only remove steps you are
certain are unnecessary. When in doubt, keep the step.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const tokenUsed = response.usage.totalTokens;

      // Parse optimized steps
      const parsed = this.parseOptimizedFlow(response.content);

      logger.success(`LLM optimization complete (${tokenUsed} tokens used)`);

      return {
        optimizedSteps: parsed.steps,
        suggestions: parsed.suggestions,
        tokenUsed,
      };
    } catch (error) {
      logger.error(`LLM optimization failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Build optimization prompt
   */
  private buildOptimizationPrompt(
    steps: FlowStep[],
    originalGoal: string,
  ): string {
    // Simplify steps for prompt (reduce token usage)
    const simplifiedSteps = steps.map((step) => ({
      id: step.id,
      tool: step.tool,
      params: step.params,
      selector: step.selector,
      status: step.status,
      recoverySelectors: step.recoveryAttempts
        ?.filter((r) => r.result === 'success')
        .map((r) => r.newSelector)
        .filter(Boolean),
    }));

    return `Optimize this browser automation flow.

ORIGINAL GOAL: ${originalGoal}

RECORDED STEPS (${steps.length} total):
${JSON.stringify(simplifiedSteps, null, 2)}

Please analyze and return an optimized version.

Return this exact JSON structure:
{
  "suggestions": [
    "Brief description of what was optimized"
  ],
  "steps": [
    {
      "id": 1,
      "tool": "navigate",
      "params": { "url": "https://example.com" },
      "selectors": ["primary-selector", "fallback-selector"],
      "selectorStrategy": "first_match",
      "reasoning": "Why this step is needed"
    }
  ]
}

OPTIMIZATION RULES:
1. Keep all steps that are essential to the goal
2. For steps with successful error recovery:
   - Use the WORKING selector as primary
   - Add original selector as fallback
   - Format: "selectors": ["working-sel", "original-sel"]
3. Replace fragile selectors:
   - BAD: .css-a3bc12, nth-child(3), deeply > nested > selector
   - GOOD: #id, [data-testid="x"], [aria-label="x"], [name="x"]
4. Add clear reasoning for each step
5. Reduce total step count where safe
6. Use "fill" instead of "type" where delay is not needed`;
  }

  /**
   * Parse LLM optimization response
   */
  private parseOptimizedFlow(content: string): {
    steps: OptimizedStep[];
    suggestions: string[];
  } {
    try {
      // Extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        steps: parsed.steps || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      logger.error(`Failed to parse LLM response: ${(error as Error).message}`);
      throw error;
    }
  }
}
