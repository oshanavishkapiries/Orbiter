import { LLMProvider, Message, ToolCall } from '../llm/types.js';
import { getToolRegistry } from '../tools/registry.js';
import { ExecutionContext } from './execution-context.js';
import { TaskPlan } from './planner.js';
import { SYSTEM_PROMPT } from '../llm/prompts/system.js';
import { FlowRecorder } from '../recorder/recorder.js';
import { OutputFormatter } from '../recorder/output-formatter.js';
import { logger } from '../cli/ui/logger.js';
import { config } from '../config/index.js';
import chalk from 'chalk';

export interface ExecutionResult {
  success: boolean;
  steps: ExecutionStep[];
  flowPath?: string;
  outputFiles?: string[];
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
  private recorder: FlowRecorder;
  private formatter: OutputFormatter;
  private extractedData: any[] = [];

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
    private plan: TaskPlan,
    private llmProviderName: string = 'openrouter',
    private llmModelName: string = 'unknown',
  ) {
    // Initialize conversation
    this.conversationHistory.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });

    this.conversationHistory.push({
      role: 'user',
      content: `Please accomplish this task: ${plan.goal}`,
    });

    // Initialize recorder
    this.recorder = new FlowRecorder(plan.goal, llmProviderName, llmModelName);

    this.formatter = new OutputFormatter();
  }

  /**
   * Execute the planned task
   */
  async execute(maxSteps: number = 50): Promise<ExecutionResult> {
    const cfg = config();
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    const registry = getToolRegistry();

    // Start recording
    if (cfg.recording.enabled) {
      this.recorder.start();
    }

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
        const tools = registry.getToolsForLLM();
        const response = await this.llm.chat(this.conversationHistory, tools);

        // Track tokens
        this.totalTokens += response.usage.totalTokens;
        this.recorder.updateTokenUsage(response.usage.totalTokens);

        // Update page context for recorder
        if (this.context.getBrowserManager().isLaunched()) {
          const browser = this.context.getBrowserManager();
          const url = browser.getUrl();
          const title = await browser.getTitle().catch(() => '');
          this.recorder.updatePageContext(url, title);
        }

        // Task complete - LLM finished
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

            // Collect extracted data
            if (
              stepResult.success &&
              (toolCall.name === 'extract_data' ||
                toolCall.name === 'extract_text')
            ) {
              const data = stepResult.result?.data;
              if (data) {
                if (Array.isArray(data)) {
                  this.extractedData.push(...data);
                } else {
                  this.extractedData.push(data);
                }
              }
            }

            // Context record
            this.context.recordStep(
              stepResult.toolName,
              JSON.stringify(stepResult.params),
              stepResult.success ? 'success' : 'failed',
              stepResult.error,
            );

            // Critical failure check
            if (!stepResult.success && this.isCriticalFailure(stepResult)) {
              logger.error('Critical failure, stopping execution');
              continueExecution = false;
              break;
            }

            // Update conversation
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
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content,
          });

          if (this.isTaskComplete(response.content)) {
            continueExecution = false;
          }
        }
      } catch (error) {
        logger.error(`Execution error: ${(error as Error).message}`);
        continueExecution = false;
      }
    }

    // Stop recording
    this.recorder.stop();

    // Save flow
    let flowPath: string | undefined;
    if (cfg.recording.enabled) {
      flowPath = await this.recorder.save();
    }

    // Save extracted data
    const outputFiles: string[] = [];
    if (this.extractedData.length > 0) {
      const filename = this.formatter.generateFilename(
        this.recorder.getFlowName(),
      );
      const files = this.formatter.saveAll(this.extractedData, filename);
      outputFiles.push(...files);

      if (flowPath) {
        this.recorder.setExtractedDataFile(files[0] || '');
      }
    }

    const duration = Date.now() - startTime;
    const successfulSteps = steps.filter((s) => s.success).length;
    const failedSteps = steps.filter((s) => !s.success).length;

    const result: ExecutionResult = {
      success: failedSteps === 0 && steps.length > 0,
      steps,
      flowPath,
      outputFiles: outputFiles.length > 0 ? outputFiles : undefined,
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
   * Execute a single tool call with recording
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

    if (toolCall.arguments.selector) {
      logger.bullet(`Selector: ${chalk.gray(toolCall.arguments.selector)}`);
    }

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
        if (result.message) logger.bullet(result.message);

        // Record success
        this.recorder.recordSuccess(
          toolCall.name,
          toolCall.arguments,
          result,
          duration,
        );

        // Detect parameters
        this.recorder.detectParameters(toolCall.arguments);
      } else {
        logger.fail(`${toolCall.name} failed: ${result.error}`);

        // Record failure
        this.recorder.recordFailure(
          toolCall.name,
          toolCall.arguments,
          {
            type: 'tool_error',
            message: result.error || 'Unknown error',
            selector: toolCall.arguments.selector,
            screenshot: result.screenshot,
          },
          duration,
        );
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
      const errorMsg = (error as Error).message;

      logger.fail(`${toolCall.name} crashed: ${errorMsg}`);

      // Record failure
      this.recorder.recordFailure(
        toolCall.name,
        toolCall.arguments,
        {
          type: 'exception',
          message: errorMsg,
          selector: toolCall.arguments.selector,
        },
        duration,
      );

      return {
        stepNumber,
        toolName: toolCall.name,
        params: toolCall.arguments,
        result: null,
        success: false,
        error: errorMsg,
        duration,
      };
    }
  }

  /**
   * Check critical failure
   */
  private isCriticalFailure(step: ExecutionStep): boolean {
    if (step.toolName === 'navigate' && !step.success) return true;

    const recentSteps = this.context.getState().history.slice(-3);
    const recentFailures = recentSteps.filter(
      (s) => s.result === 'failed',
    ).length;
    if (recentFailures >= 3) return true;

    return false;
  }

  /**
   * Check if task complete
   */
  private isTaskComplete(content: string): boolean {
    const phrases = [
      'task complete',
      'task is complete',
      'finished',
      'done',
      'successfully completed',
    ];
    const lower = content.toLowerCase();
    return phrases.some((p) => lower.includes(p));
  }

  /**
   * Display execution summary
   */
  private displaySummary(result: ExecutionResult): void {
    console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');

    if (result.success) {
      console.log(chalk.green.bold('✅ EXECUTION COMPLETE') + '\n');
    } else {
      console.log(
        chalk.yellow.bold('⚠️  EXECUTION COMPLETE WITH ERRORS') + '\n',
      );
    }

    console.log(chalk.bold('Summary:'));
    console.log(`  Total steps: ${result.summary.totalSteps}`);
    console.log(
      `  ${chalk.green('✓')} Successful: ${result.summary.successfulSteps}`,
    );

    if (result.summary.failedSteps > 0) {
      console.log(`  ${chalk.red('✖')} Failed: ${result.summary.failedSteps}`);
    }

    console.log(`  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);
    console.log(`  Tokens: ${result.summary.tokensUsed.toLocaleString()}`);

    const cost = ((result.summary.tokensUsed / 1_000_000) * 3).toFixed(4);
    console.log(`  Cost: $${cost} 💰`);

    if (result.outputFiles && result.outputFiles.length > 0) {
      console.log('\n' + chalk.bold('Output files:'));
      for (const file of result.outputFiles) {
        console.log(`  📄 ${file}`);
      }
    }

    if (result.flowPath) {
      console.log('\n' + chalk.bold('Flow recorded:'));
      console.log(`  📝 ${result.flowPath}`);
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(`  • Optimize: orbiter refine ${result.flowPath}`);
      const replayPath = result.flowPath.replace('.raw.json', '.flow.json');
      console.log(`  • Replay:   orbiter replay ${replayPath}`);
    }

    console.log('');
  }

  /**
   * Get recorder stats
   */
  getRecorderStats() {
    return this.recorder.getStats();
  }
}
