import { LLMProvider, Message } from '../llm/types.js';
import { getToolRegistry } from '../tools/registry.js';
import { SYSTEM_PROMPT, getUserPrompt } from '../llm/prompts/system.js';
import { logger } from '../cli/ui/logger.js';

export interface TaskPlan {
  goal: string;
  estimatedSteps: number;
  reasoning: string;
  needsDetection?: boolean;
}

export class TaskPlanner {
  constructor(private llm: LLMProvider) {}

  /**
   * Analyze user prompt and create execution plan
   */
  async plan(userGoal: string): Promise<TaskPlan> {
    logger.info('Planning task...');

    const registry = getToolRegistry();
    const tools = registry.getToolsForLLM();

    const messages: Message[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: getUserPrompt(userGoal),
      },
    ];

    try {
      const response = await this.llm.chat(messages, tools);

      // Parse plan from response
      const plan: TaskPlan = {
        goal: userGoal,
        estimatedSteps: this.estimateSteps(response.content),
        reasoning: response.content,
        needsDetection: this.detectPatternNeed(userGoal),
      };

      logger.info(`Task planned: ~${plan.estimatedSteps} steps estimated`);
      logger.debug('LLM reasoning:', { reasoning: plan.reasoning });

      return plan;
    } catch (error) {
      logger.error(`Planning failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Estimate number of steps from LLM response
   */
  private estimateSteps(content: string): number {
    // Look for numbered steps in response
    const matches = content.match(/\d+\./g);
    if (matches) {
      return matches.length;
    }

    // Estimate based on keywords
    const actionKeywords = [
      'navigate',
      'click',
      'type',
      'fill',
      'scroll',
      'wait',
    ];
    let count = 0;
    for (const keyword of actionKeywords) {
      const regex = new RegExp(keyword, 'gi');
      const found = content.match(regex);
      if (found) count += found.length;
    }

    return Math.max(count, 3); // Minimum 3 steps
  }

  /**
   * Detect if task needs pattern detection (Loop Engine)
   */
  private detectPatternNeed(goal: string): boolean {
    const keywords = [
      'extract all',
      'get all',
      'list of',
      'multiple',
      'every',
      'each',
      'scrape',
      'collect',
    ];

    const lowerGoal = goal.toLowerCase();
    return keywords.some((keyword) => lowerGoal.includes(keyword));
  }
}
