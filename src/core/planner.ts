import { LLMProvider, Message } from '../llm/types.js';
import { PLANNING_SYSTEM_PROMPT, getPlanningPrompt } from '../llm/prompts/system.js';
import { logger } from '../cli/ui/logger.js';

export interface TaskPlan {
  goal: string;
  estimatedSteps: number;
  reasoning: string;
  steps: string[];
  needsDetection?: boolean;
}

export class TaskPlanner {
  constructor(private llm: LLMProvider) {}

  /**
   * Analyze user prompt and create execution plan
   */
  async plan(userGoal: string): Promise<TaskPlan> {
    logger.info('Planning task...');

    const messages: Message[] = [
      {
        role: 'system',
        content: PLANNING_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: getPlanningPrompt(userGoal),
      },
    ];

    try {
      const response = await this.llm.chat(messages, []);
      const steps = this.extractSteps(response.content);

      // Parse plan from response
      const plan: TaskPlan = {
        goal: userGoal,
        estimatedSteps: steps.length > 0 ? steps.length : this.estimateSteps(response.content),
        reasoning: response.content,
        steps,
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
    // Look for numbered list items anchored at line start (e.g. "1. Navigate...")
    const matches = content.match(/^\d+\./gm);
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
   * Extract numbered execution steps from the planner response.
   */
  private extractSteps(content: string): string[] {
    const matches = content.matchAll(/^\s*\d+\.\s+(.+)$/gm);
    const steps = Array.from(matches, (match) => match[1].trim()).filter(Boolean);
    return steps;
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
