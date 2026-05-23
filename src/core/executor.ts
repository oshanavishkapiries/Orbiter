import { LLMProvider, Tool, ToolCall } from '../llm/types.js';
import { getToolRegistry } from '../tools/registry.js';
import { ExecutionContext } from './execution-context.js';
import { TaskPlan } from './planner.js';
import { SYSTEM_PROMPT } from '../llm/prompts/system.js';
import { HistoryManager } from './history-manager.js';
import { SessionRepository } from '../memory/database/repositories/session-repository.js';
import { DatabaseConnection } from '../memory/database/connection.js';
import { ChatLogger } from '../llm/chat-logger.js';
import { FlowRecorder } from '../recorder/recorder.js';
import { OutputFormatter } from '../recorder/output-formatter.js';
import { logger } from '../cli/ui/logger.js';
import { config } from '../config/index.js';
import { ErrorContextBuilder } from './errors/context-builder.js';
import { RecoveryEngine } from './errors/recovery-engine.js';
import { ExecutionSnapshot } from './errors/types.js';
import { validateToolCall } from '../tools/validator.js';
import { SkillLoader } from '../skills/loader.js';
import { BrowserOverlay } from './overlay.js';
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
    inputTokens: number;
    outputTokens: number;
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
  private history!: HistoryManager;
  private totalTokens = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private recorder: FlowRecorder;
  private formatter: OutputFormatter;
  private extractedData: any[] = [];
  private recoveryEngine: RecoveryEngine;
  private sessionRepo: SessionRepository | null = null;
  private sessionId: string | null = null;
  private skillLoader: SkillLoader;
  private injectedSkills = new Set<string>();
  private overlay: BrowserOverlay;

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
    private plan: TaskPlan,
    private llmProviderName: string = 'openrouter',
    private llmModelName: string = 'unknown',
    overlayEnabled: boolean = false,
  ) {
    this.recoveryEngine = new RecoveryEngine(llm, context);
    context.setLLM(llm);
    this.recorder = new FlowRecorder(plan.goal, llmProviderName, llmModelName);
    this.formatter = new OutputFormatter();
    this.skillLoader = new SkillLoader();
    this.overlay = new BrowserOverlay(overlayEnabled);
  }

  async execute(maxSteps: number = 50): Promise<ExecutionResult> {
    const cfg = config();
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    const registry = getToolRegistry();
    const mcpClient = this.context.getMcpClient();

    // Merge MCP tools + custom tools for the LLM
    const allTools: Tool[] = [...mcpClient.getTools(), ...registry.getToolsForLLM()];

    // Initialize session memory (non-fatal if DB unavailable)
    try {
      await DatabaseConnection.getInstance().initialize();
      this.sessionRepo = new SessionRepository();
      this.sessionId = await this.sessionRepo.createSession(
        this.plan.goal,
        this.llmModelName,
        this.llmProviderName,
      );
      this.context.setSession(this.sessionRepo, this.sessionId);
      this.history = new HistoryManager(
        SYSTEM_PROMPT,
        this.plan.goal,
        this.sessionRepo,
        this.sessionId,
      );
      ChatLogger.getInstance().startSession(this.sessionId, this.sessionRepo);
      logger.debug(`Session started: ${this.sessionId}`);
    } catch (err) {
      logger.debug(`Session DB unavailable, running without session memory: ${(err as Error).message}`);
      this.history = new HistoryManager(SYSTEM_PROMPT, this.plan.goal, null, null);
      ChatLogger.getInstance().startSession(null, null);
    }

    if (cfg.recording.enabled) {
      this.recorder.start();
    }

    logger.info(`Starting execution (max ${maxSteps} steps)`);
    this.context.setTotalSteps(maxSteps);

    let stepNumber = 0;
    let continueExecution = true;

    while (continueExecution && stepNumber < maxSteps) {
      stepNumber++;

      logger.step(stepNumber, maxSteps, 'thinking', 'LLM deciding next action...');

      try {
        const response = await this.llm.chat(this.history.getMessages(), allTools);

        this.totalTokens += response.usage.totalTokens;
        this.totalInputTokens += response.usage.promptTokens;
        this.totalOutputTokens += response.usage.completionTokens;
        this.recorder.updateTokenUsage(response.usage.totalTokens);

        // Update page context; inject site skill on first visit
        try {
          const url = await mcpClient.getCurrentUrl();
          const title = await mcpClient.getTitle();
          if (url) {
            this.recorder.updatePageContext(url, title);
            const skill = this.skillLoader.matchUrl(url);
            if (skill && !this.injectedSkills.has(skill.domain)) {
              this.injectedSkills.add(skill.domain);
              this.history.injectSkillContext(skill.name, skill.context);
              logger.info(`Site skill injected: ${skill.name}`);
            }
          }
        } catch {
          // no page navigated yet
        }

        if (response.finishReason === 'stop' && !response.toolCalls) {
          logger.success('Task completed by LLM');
          this.history.addAssistantText(response.content);
          if (response.content?.trim()) {
            console.log('\n' + chalk.cyan('─'.repeat(60)));
            console.log(chalk.bold('\nResult:\n'));
            console.log(response.content.trim());
            console.log('');
          }
          continueExecution = false;
          break;
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const stepResult = await this.executeToolCall(toolCall, stepNumber, maxSteps);
            steps.push(stepResult);

            await this.overlay.update(
              mcpClient, stepNumber, maxSteps,
              toolCall.name, stepResult.success, this.extractedData.length,
            );

            if (stepResult.success && (toolCall.name === 'save_extracted_data' || toolCall.name === 'bulk_extract')) {
              const data = stepResult.result?.data;
              if (data) {
                if (Array.isArray(data)) {
                  this.extractedData.push(...data);
                } else {
                  this.extractedData.push(data);
                }
              }
            }

            this.context.recordStep(
              stepResult.toolName,
              JSON.stringify(stepResult.params),
              stepResult.success ? 'success' : 'failed',
              stepResult.error,
            );

            if (!stepResult.success && this.isCriticalFailure(stepResult)) {
              logger.error('Critical failure, stopping execution');
              continueExecution = false;
              break;
            }

            this.history.addAssistantAction(toolCall.id, toolCall.name, toolCall.arguments);
            const imageBase64 = this.llm.supportsVision()
              ? stepResult.result?.imageBase64
              : undefined;
            await this.history.addToolResult(
              toolCall.id,
              stepNumber,
              toolCall.name,
              stepResult.result,
              toolCall.arguments,
              stepResult.duration,
              imageBase64,
            );

            logger.debug(`History size: ${this.history.size()} messages`);
          }
        } else {
          this.history.addAssistantText(response.content);
          if (this.isTaskComplete(response.content)) {
            continueExecution = false;
          }
        }
      } catch (error) {
        logger.error(`Execution error: ${(error as Error).message}`);
        continueExecution = false;
      }
    }

    if (this.sessionRepo && this.sessionId) {
      const failed = steps.filter((s) => !s.success).length;
      await this.sessionRepo
        .completeSession(this.sessionId, failed > 0 ? 'failed' : 'completed')
        .catch(() => {});
    }

    await this.overlay.remove(mcpClient);
    this.recorder.stop();

    let flowPath: string | undefined;
    if (cfg.recording.enabled) {
      flowPath = await this.recorder.save();
    }

    const outputFiles: string[] = [];
    if (this.extractedData.length > 0) {
      const filename = this.formatter.generateFilename(this.recorder.getFlowName());
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
        inputTokens: this.totalInputTokens,
        outputTokens: this.totalOutputTokens,
      },
    };

    this.displaySummary(result);
    return result;
  }

  private async executeToolCall(
    toolCall: ToolCall,
    stepNumber: number,
    totalSteps: number,
  ): Promise<ExecutionStep> {
    const startTime = Date.now();
    const mcpClient = this.context.getMcpClient();
    const registry = getToolRegistry();
    const isMcp = mcpClient.isMcpTool(toolCall.name);

    logger.step(stepNumber, totalSteps, toolCall.name, `Executing ${toolCall.name}...`);
    logger.bullet(`Tool: ${chalk.cyan(toolCall.name)}`);

    // Only validate custom tools — MCP tools are validated server-side
    if (!isMcp) {
      const validation = validateToolCall(toolCall.name, toolCall.arguments);
      if (!validation.valid) {
        const duration = Date.now() - startTime;
        const errorMsg = `INVALID_TOOL_CALL: ${validation.error}`;
        logger.fail(`${toolCall.name} rejected: ${validation.error}`);
        return {
          stepNumber,
          toolName: toolCall.name,
          params: toolCall.arguments,
          result: { success: false, error: errorMsg },
          success: false,
          error: errorMsg,
          duration,
        };
      }
    }

    let attemptNumber = 0;
    let lastError: Error | null = null;

    while (attemptNumber < 4) {
      attemptNumber++;

      try {
        const result = isMcp
          ? await mcpClient.callTool(toolCall.name, toolCall.arguments)
          : await registry.execute(toolCall.name, toolCall.arguments, this.context);

        const duration = Date.now() - startTime;

        if (result.success) {
          logger.success(`${toolCall.name} completed in ${(duration / 1000).toFixed(1)}s`);
          // MCP tool messages are raw browser output (snapshots, Playwright code) — skip printing
          if (!isMcp && result.message) logger.bullet(result.message);

          this.recorder.recordSuccess(
            toolCall.name,
            toolCall.arguments,
            result,
            duration,
            attemptNumber > 1
              ? { wasRetry: true, retryAttempt: attemptNumber }
              : { wasRetry: false },
          );
          this.recorder.detectParameters(toolCall.arguments);

          return {
            stepNumber,
            toolName: toolCall.name,
            params: toolCall.arguments,
            result,
            success: true,
            duration,
          };
        } else {
          throw new Error(result.error || `Tool ${toolCall.name} failed`);
        }
      } catch (error) {
        lastError = error as Error;

        if (this.isInvalidToolCallError(lastError)) {
          logger.fail(`${toolCall.name} rejected locally: ${lastError.message}`);
          break;
        }

        logger.fail(`${toolCall.name} failed (attempt ${attemptNumber}): ${lastError.message}`);

        const contextBuilder = new ErrorContextBuilder(mcpClient);
        const executionSnapshot: ExecutionSnapshot = {
          originalGoal: this.plan.goal,
          stepNumber,
          totalSteps,
          previousSteps: this.context.getLastSuccessfulSteps(5).map((s) => ({
            step: s.step,
            tool: s.action,
            result: s.result,
          })),
          tokensUsedSoFar: this.totalTokens,
        };

        const errorContext = await contextBuilder.build(
          lastError,
          toolCall.name,
          toolCall.arguments,
          attemptNumber,
          executionSnapshot,
        );

        this.recorder.recordFailure(
          toolCall.name,
          toolCall.arguments,
          {
            type: errorContext.error.type,
            message: errorContext.error.message,
            selector: toolCall.arguments.selector,
            screenshot: errorContext.browserState.screenshotPath,
          },
          Date.now() - startTime,
          { wasRetry: attemptNumber > 1, retryAttempt: attemptNumber },
        );

        const recovery = await this.recoveryEngine.recover(errorContext);

        if (recovery.shouldAbort) {
          logger.error(`Aborting: ${recovery.abortReason}`);
          break;
        }

        if (recovery.success) {
          if (errorContext.recoveryHistory.length > 0) {
            const lastAttempt = errorContext.recoveryHistory[errorContext.recoveryHistory.length - 1];
            if (lastAttempt.action) {
              toolCall.arguments = lastAttempt.action.params;
            }
          }

          const duration = Date.now() - startTime;
          this.recorder.addRecoveryAttempt({
            attempt: attemptNumber,
            strategy: errorContext.recoveryHistory[errorContext.recoveryHistory.length - 1]?.strategy || 'unknown',
            newSelector: toolCall.arguments.selector,
            result: 'success',
            llmReasoning: errorContext.recoveryHistory[errorContext.recoveryHistory.length - 1]?.reasoning,
          });

          return {
            stepNumber,
            toolName: toolCall.name,
            params: toolCall.arguments,
            result: recovery.result,
            success: true,
            duration,
          };
        }

        if (recovery.error && this.isInvalidRecoveryPlan(recovery.error)) {
          lastError = new Error(`INVALID_TOOL_CALL: ${recovery.error}`);
          break;
        }

        if (attemptNumber >= 3) break;
      }
    }

    const duration = Date.now() - startTime;
    logger.fail(`${toolCall.name} failed after ${attemptNumber} attempts`);

    return {
      stepNumber,
      toolName: toolCall.name,
      params: toolCall.arguments,
      result: null,
      success: false,
      error: lastError?.message || 'Unknown error',
      duration,
    };
  }

  private isCriticalFailure(step: ExecutionStep): boolean {
    if (this.isInvalidToolCall(step)) return false;
    if (step.toolName === 'browser_navigate' && !step.success) return true;

    const recentSteps = this.context.getState().history.slice(-3);
    const recentFailures = recentSteps.filter((s) => s.result === 'failed').length;
    if (recentFailures >= 3) return true;

    return false;
  }

  private isTaskComplete(content: string): boolean {
    const phrases = ['task complete', 'task is complete', 'finished', 'done', 'successfully completed'];
    const lower = content.toLowerCase();
    return phrases.some((p) => lower.includes(p));
  }

  private isInvalidToolCall(step: ExecutionStep): boolean {
    return typeof step.error === 'string' && step.error.startsWith('INVALID_TOOL_CALL:');
  }

  private isInvalidToolCallError(error: Error): boolean {
    return error.message.startsWith('INVALID_TOOL_CALL:');
  }

  private isInvalidRecoveryPlan(reason?: string): boolean {
    return typeof reason === 'string' && reason.startsWith('INVALID_RECOVERY_PLAN:');
  }

  private displaySummary(result: ExecutionResult): void {
    console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');

    if (result.success) {
      console.log(chalk.green.bold('✅ EXECUTION COMPLETE') + '\n');
    } else {
      console.log(chalk.yellow.bold('⚠️  EXECUTION COMPLETE WITH ERRORS') + '\n');
    }

    console.log(chalk.bold('Summary:'));
    console.log(`  Total steps: ${result.summary.totalSteps}`);
    console.log(`  ${chalk.green('✓')} Successful: ${result.summary.successfulSteps}`);
    if (result.summary.failedSteps > 0) {
      console.log(`  ${chalk.red('✖')} Failed: ${result.summary.failedSteps}`);
    }
    console.log(`  Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);
    console.log(`  Tokens: ${result.summary.tokensUsed.toLocaleString()}`);

    const caps = (this.llm as any).getCapabilities?.();
    const cost = caps
      ? ((result.summary.inputTokens / 1_000_000) * caps.inputPricePerMToken +
         (result.summary.outputTokens / 1_000_000) * caps.outputPricePerMToken).toFixed(4)
      : ((result.summary.tokensUsed / 1_000_000) * 3).toFixed(4);
    console.log(`  Cost: $${cost}`);

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

  getRecorderStats() {
    return this.recorder.getStats();
  }
}
