import { LLMProvider, Message, ToolCall } from '../llm/types.js';
import { getToolRegistry } from '../tools/registry.js';
import { ExecutionContext } from './execution-context.js';
import { TaskPlan } from './planner.js';
import { SYSTEM_PROMPT } from '../llm/prompts/system.js';
import { logger } from '../cli/ui/logger.js';
import chalk from 'chalk';

export interface ExecutionResult {
  success: boolean;
  steps: ExecutionStep[];
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    duration: number;
    tokensUsed: number;
  };
  error?: string;
}

export interface ExecutionStep {
  stepNumber: number;
  toolName: string;
  params: any;
  result: any;
  success: boolean;
  error?: string;
  duration: number;
}

export class TaskExecutor {
  private conversationHistory: Message[] = [];
  private totalTokens = 0;

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
    private plan: TaskPlan,
  ) {
    // Initialize conversation with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });

    // Add user goal
    this.conversationHistory.push({
      role: 'user',
      content: `Please accomplish this task: ${plan.goal}`,
    });
  }

  /**
   * Execute the planned task
   */
  async execute(maxSteps: number = 50): Promise<ExecutionResult> {
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    const registry = getToolRegistry();

    logger.info(`Starting execution (max ${maxSteps} steps)`);
    this.context.setTotalSteps(maxSteps);

    let stepNumber = 0;
    let continueExecution = true;

    while (continueExecution && stepNumber < maxSteps) {
      stepNumber++;

      logger.step(
        stepNumber,
        maxSteps,
        'thinking',
        'LLM deciding next action...',
      );

      try {
        // Get next action from LLM
        const tools = registry.getToolsForLLM();
        const response = await this.llm.chat(this.conversationHistory, tools);

        // Track token usage
        this.totalTokens += response.usage.totalTokens;

        // Check if LLM finished the task
        if (response.finishReason === 'stop' && !response.toolCalls) {
          logger.success('Task completed by LLM');
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content,
          });
          continueExecution = false;
          break;
        }

        // Execute tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const stepResult = await this.executeToolCall(
              toolCall,
              stepNumber,
              maxSteps,
            );
            steps.push(stepResult);

            // Record in context
            this.context.recordStep(
              stepResult.toolName,
              JSON.stringify(stepResult.params),
              stepResult.success ? 'success' : 'failed',
              stepResult.error,
            );

            // If step failed critically, stop execution
            if (!stepResult.success && this.isCriticalFailure(stepResult)) {
              logger.error('Critical failure, stopping execution');
              continueExecution = false;
              break;
            }

            // Add tool result to conversation
            this.conversationHistory.push({
              role: 'assistant',
              content: `Used ${toolCall.name}: ${JSON.stringify(toolCall.arguments)}`,
            });

            this.conversationHistory.push({
              role: 'user',
              content: `Tool result: ${JSON.stringify(stepResult.result)}`,
            });
          }
        } else {
          // LLM responded with text but no tool calls
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content,
          });

          // Check if it's asking for clarification or finished
          if (this.isTaskComplete(response.content)) {
            logger.success('Task appears complete');
            continueExecution = false;
          }
        }
      } catch (error) {
        logger.error(`Execution error: ${(error as Error).message}`);

        steps.push({
          stepNumber,
          toolName: 'error',
          params: {},
          result: null,
          success: false,
          error: (error as Error).message,
          duration: 0,
        });

        continueExecution = false;
      }
    }

    const duration = Date.now() - startTime;

    // Generate summary
    const successfulSteps = steps.filter((s) => s.success).length;
    const failedSteps = steps.filter((s) => !s.success).length;

    const result: ExecutionResult = {
      success: failedSteps === 0 && steps.length > 0,
      steps,
      summary: {
        totalSteps: steps.length,
        successfulSteps,
        failedSteps,
        duration,
        tokensUsed: this.totalTokens,
      },
    };

    this.displaySummary(result);

    return result;
  }

  /**
   * Execute a single tool call
   */
  private async executeToolCall(
    toolCall: ToolCall,
    stepNumber: number,
    totalSteps: number,
  ): Promise<ExecutionStep> {
    const startTime = Date.now();
    const registry = getToolRegistry();

    logger.step(
      stepNumber,
      totalSteps,
      toolCall.name,
      `Executing ${toolCall.name}...`,
    );

    logger.bullet(`Tool: ${chalk.cyan(toolCall.name)}`);
    logger.bullet(
      `Params: ${chalk.gray(JSON.stringify(toolCall.arguments, null, 2))}`,
    );

    try {
      const result = await registry.execute(
        toolCall.name,
        toolCall.arguments,
        this.context,
      );

      const duration = Date.now() - startTime;

      if (result.success) {
        logger.success(
          `${toolCall.name} completed in ${(duration / 1000).toFixed(1)}s`,
        );
        if (result.message) {
          logger.bullet(`Result: ${result.message}`);
        }
      } else {
        logger.fail(`${toolCall.name} failed: ${result.error}`);
        if (result.screenshot) {
          logger.bullet(`Screenshot: ${result.screenshot}`);
        }
      }

      return {
        stepNumber,
        toolName: toolCall.name,
        params: toolCall.arguments,
        result,
        success: result.success,
        error: result.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.fail(`${toolCall.name} failed: ${(error as Error).message}`);

      return {
        stepNumber,
        toolName: toolCall.name,
        params: toolCall.arguments,
        result: null,
        success: false,
        error: (error as Error).message,
        duration,
      };
    }
  }

  /**
   * Check if failure is critical (should stop execution)
   */
  private isCriticalFailure(step: ExecutionStep): boolean {
    // Navigation failures are usually critical
    if (step.toolName === 'navigate' && !step.success) {
      return true;
    }

    // Multiple consecutive failures
    const recentSteps = this.context.getState().history.slice(-3);
    const recentFailures = recentSteps.filter(
      (s) => s.result === 'failed',
    ).length;
    if (recentFailures >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Check if task is complete based on LLM response
   */
  private isTaskComplete(content: string): boolean {
    const completionPhrases = [
      'task complete',
      'task is complete',
      'finished',
      'done',
      'successfully completed',
      'all set',
    ];

    const lower = content.toLowerCase();
    return completionPhrases.some((phrase) => lower.includes(phrase));
  }

  /**
   * Display execution summary
   */
  private displaySummary(result: ExecutionResult): void {
    console.log('\n' + chalk.green('✅ EXECUTION COMPLETE') + '\n');

    console.log(chalk.bold('Summary:'));
    console.log(`  Total steps: ${result.summary.totalSteps}`);
    console.log(
      `  ${chalk.green('✓')} Successful: ${result.summary.successfulSteps}`,
    );
    if (result.summary.failedSteps > 0) {
      console.log(`  ${chalk.red('✖')} Failed: ${result.summary.failedSteps}`);
    }
    console.log(`  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);
    console.log(`  Tokens used: ${result.summary.tokensUsed.toLocaleString()}`);

    // Estimate cost (rough estimate for Claude Sonnet 4)
    const estimatedCost = ((result.summary.tokensUsed / 1000000) * 3) // $3 per 1M tokens (average)
      .toFixed(4);
    console.log(`  Estimated cost: $${estimatedCost}\n`);
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Message[] {
    return this.conversationHistory;
  }

  /**
   * Get total tokens used
   */
  getTotalTokens(): number {
    return this.totalTokens;
  }
}
