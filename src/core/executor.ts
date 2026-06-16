import { LLMProvider, Tool, ToolCall } from '../llm/types.js';
import { getToolRegistry } from '../tools/registry.js';
import { ExecutionContext } from './execution-context.js';
import { SYSTEM_PROMPT } from '../llm/prompts/system.js';
import { eventBus } from '../server/event-bus.js';
import { HistoryManager } from './history-manager.js';
import { checkExecutionControl } from '../server/execution-control.js';
import { SessionRepository } from '../memory/database/repositories/session-repository.js';
import { DataRepository } from '../memory/database/repositories/data-repository.js';
import { DatabaseConnection } from '../memory/database/connection.js';
import { ChatLogger } from '../llm/chat-logger.js';
import { FlowRecorder } from '../recorder/recorder.js';
import { logger } from '../cli/ui/logger.js';
import { injectLogPool } from '../cli/ui/db-log-transport.js';
import { config } from '../config/index.js';
import { ErrorContextBuilder } from './errors/context-builder.js';
import { RecoveryEngine } from './errors/recovery-engine.js';
import { ExecutionSnapshot } from './errors/types.js';
import { validateToolCall } from '../tools/validator.js';
import { ElementHighlighter } from './element-highlighter.js';
import chalk from 'chalk';

export interface ExecutionResult {
  success: boolean;
  steps: ExecutionStep[];
  sessionId?: string;
  flowId?: string;
  outputs?: string[];
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
  private outputs: string[] = [];
  private savedRecordCount = 0;
  private recoveryEngine: RecoveryEngine;
  private sessionRepo: SessionRepository | null = null;
  private sessionId: string | null = null;
  private highlighter: ElementHighlighter;

  constructor(
    private llm: LLMProvider,
    private context: ExecutionContext,
    private goal: string,
    private llmProviderName: string = 'openrouter',
    private llmModelName: string = 'unknown',
    highlightEnabled: boolean = false,
    private sessionTitle?: string,
  ) {
    this.recoveryEngine = new RecoveryEngine(llm, context);
    context.setLLM(llm);
    this.recorder = new FlowRecorder(goal, llmProviderName, llmModelName);
    this.highlighter = new ElementHighlighter(highlightEnabled);
  }

  async execute(maxSteps?: number): Promise<ExecutionResult> {
    const cfg = config();
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    const registry = getToolRegistry();
    const mcpClient = this.context.getMcpClient();

    // Merge MCP tools + custom tools for the LLM
    const allTools: Tool[] = [
      ...mcpClient.getTools(),
      ...registry.getToolsForLLM(),
    ];

    // Initialize session memory (non-fatal if DB unavailable)
    let resolvedMaxSteps = maxSteps ?? 100;
    try {
      await DatabaseConnection.getInstance().initialize();
      injectLogPool(DatabaseConnection.getInstance().getPool());

      const dataRepo = new DataRepository();
      await dataRepo.seedSettings(cfg).catch(() => {});

      // Read execution.maxSteps from DB when not explicitly overridden by CLI
      if (maxSteps === undefined) {
        const dbMaxSteps = await dataRepo
          .getSetting('execution.maxSteps')
          .catch(() => null);
        if (dbMaxSteps) resolvedMaxSteps = parseInt(dbMaxSteps) || 100;
      }

      this.sessionRepo = new SessionRepository();

      let finalTitle = this.sessionTitle;
      if (!finalTitle || finalTitle === 'New Session') {
        try {
          const response = await this.llm.chat([
            {
              role: 'system',
              content: 'You are a session title generator. Generate a very short, concise, 2-5 word name for a browser automation session based on the user\'s goal. Do not use quotes, punctuation, or extra words. Example: "Search DeepMind Links" or "Login to GitHub".',
            },
            {
              role: 'user',
              content: `Goal: ${this.goal}`,
            },
          ]);
          finalTitle = response.content.replace(/"/g, '').trim();
        } catch (err) {
          finalTitle = 'New Session';
        }
      }

      if (!this.sessionId) {
        this.sessionId = await this.sessionRepo.createSession(
          this.goal,
          this.llmModelName,
          this.llmProviderName,
          undefined,
          finalTitle,
        );
      } else {
        await this.sessionRepo.updateSessionTitle(this.sessionId, finalTitle);
      }
      this.context.setSession(this.sessionRepo, this.sessionId);
      this.recorder.setSessionId(this.sessionId);
      this.recorder.setDataRepo(dataRepo);
      this.history = new HistoryManager(
        SYSTEM_PROMPT,
        this.goal,
        this.sessionRepo,
        this.sessionId,
      );
      ChatLogger.getInstance().startSession(this.sessionId, this.sessionRepo);
      logger.debug(`Session started: ${this.sessionId}`);
    } catch (err) {
      logger.debug(
        `Session DB unavailable, running without session memory: ${(err as Error).message}`,
      );
      this.history = new HistoryManager(SYSTEM_PROMPT, this.goal, null, null);
      ChatLogger.getInstance().startSession(null, null);
    }

    const effectiveMaxSteps = resolvedMaxSteps;

    if (cfg.recording.enabled) {
      this.recorder.start();
    }

    logger.info(`Starting execution (max ${effectiveMaxSteps} steps)`);
    this.context.setTotalSteps(effectiveMaxSteps);

    let stepNumber = 0;
    let continueExecution = true;
    let stepLimitWarned = false;

    while (continueExecution && stepNumber < effectiveMaxSteps) {
      await checkExecutionControl(this.sessionId);
      stepNumber++;

      // Warn LLM when only a few steps remain so it can save data and wrap up
      const stepsLeft = effectiveMaxSteps - stepNumber;
      if (!stepLimitWarned && stepsLeft <= 5) {
        stepLimitWarned = true;
        logger.warn(
          `Only ${stepsLeft} step(s) remaining — injecting save reminder`,
        );
        this.history.addUserText(
          `[SYSTEM] You have only ${stepsLeft} step(s) remaining before execution stops. ` +
            `If you have collected any data, call save_json or save_csv NOW to persist it, then stop.`,
        );
      }

      logger.step(
        stepNumber,
        effectiveMaxSteps,
        'thinking',
        'LLM deciding next action...',
      );

      try {
        const response = await this.llm.chat(
          this.history.getMessages(),
          allTools,
        );

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
            const stepResult = await this.executeToolCall(
              toolCall,
              stepNumber,
              effectiveMaxSteps,
            );
            steps.push(stepResult);

            if (this.sessionId) {
              eventBus.emitStep(this.sessionId, stepResult);
              if (stepResult.result?.imageBase64) {
                eventBus.emitScreenshot(this.sessionId, {
                  imageBase64: stepResult.result.imageBase64,
                });
              }
            }

            if (
              stepResult.success &&
              (toolCall.name === 'save_csv' || toolCall.name === 'save_json')
            ) {
              const outputRef = stepResult.result?.data?.outputRef;
              const count = stepResult.result?.data?.count ?? 0;
              if (outputRef) this.outputs.push(outputRef);
              this.savedRecordCount += count;
            }

            if (stepResult.success) {
              await this.highlighter.inject(mcpClient);
            }

            this.context.recordStep(
              stepResult.toolName,
              JSON.stringify(stepResult.params),
              stepResult.success ? 'success' : 'failed',
              stepResult.error,
            );

            this.history.addAssistantAction(
              toolCall.id,
              toolCall.name,
              toolCall.arguments,
            );
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

            if (!stepResult.success && this.isCriticalFailure(stepResult)) {
              logger.error('Critical failure, stopping execution');
              continueExecution = false;
              break;
            }

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

    if (stepNumber >= effectiveMaxSteps && continueExecution) {
      logger.warn(
        `Step limit reached (${effectiveMaxSteps}/${effectiveMaxSteps}). Use --max-steps <n> to increase, or update execution.maxSteps in the settings table.`,
      );
    }

    if (this.sessionRepo && this.sessionId) {
      const failed = steps.filter((s) => !s.success).length;
      await this.sessionRepo
        .completeSession(this.sessionId, failed > 0 ? 'failed' : 'completed')
        .catch(() => {});
    }

    await this.highlighter.remove(mcpClient);
    this.recorder.stop();

    let flowId: string | undefined;
    if (cfg.recording.enabled) {
      flowId = await this.recorder.save();
    }

    const duration = Date.now() - startTime;
    const successfulSteps = steps.filter((s) => s.success).length;
    const failedSteps = steps.filter((s) => !s.success).length;

    const result: ExecutionResult = {
      success: failedSteps === 0 && steps.length > 0,
      steps,
      sessionId: this.sessionId ?? undefined,
      flowId,
      outputs: this.outputs.length > 0 ? this.outputs : undefined,
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

    logger.step(
      stepNumber,
      totalSteps,
      toolCall.name,
      `Executing ${toolCall.name}...`,
    );
    logger.bullet(`Tool: ${chalk.cyan(toolCall.name)}`);

    // In debug mode, print tool arguments so scripts/selectors are visible
    if (toolCall.name === 'browser_evaluate' && toolCall.arguments?.function) {
      const script = String(toolCall.arguments.function);
      logger.debug(
        `  ${chalk.gray('script:')} ${chalk.dim(script.length > 500 ? script.slice(0, 500) + '…' : script)}`,
      );
    } else if (
      toolCall.arguments &&
      Object.keys(toolCall.arguments).length > 0
    ) {
      logger.debug(
        `  ${chalk.gray('args:')} ${chalk.dim(JSON.stringify(toolCall.arguments).slice(0, 300))}`,
      );
    }

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
          : await registry.execute(
              toolCall.name,
              toolCall.arguments,
              this.context,
            );

        const duration = Date.now() - startTime;

        if (result.success) {
          logger.success(
            `${toolCall.name} completed in ${(duration / 1000).toFixed(1)}s`,
          );
          // MCP tool messages are raw browser output (snapshots, Playwright code) — skip printing
          if (!isMcp && result.message) logger.bullet(result.message);

          // Capture real-time screenshot for live view and trace history
          if (mcpClient.isConnected() && toolCall.name.startsWith('browser_') && toolCall.name !== 'browser_screenshot') {
            try {
              logger.debug('Capturing real-time browser screenshot for live feed...');
              const screenshotRes = await mcpClient.callTool('browser_screenshot', {});
              if (screenshotRes?.success && screenshotRes?.imageBase64) {
                result.imageBase64 = screenshotRes.imageBase64;
              }
            } catch (err) {
              logger.debug(`Failed to capture real-time screenshot: ${(err as Error).message}`);
            }
          }

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
          logger.fail(
            `${toolCall.name} rejected locally: ${lastError.message}`,
          );
          break;
        }

        logger.fail(
          `${toolCall.name} failed (attempt ${attemptNumber}): ${lastError.message}`,
        );

        const contextBuilder = new ErrorContextBuilder(
          mcpClient,
          this.sessionId,
        );
        const executionSnapshot: ExecutionSnapshot = {
          originalGoal: this.goal,
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
            const lastAttempt =
              errorContext.recoveryHistory[
                errorContext.recoveryHistory.length - 1
              ];
            if (lastAttempt.action) {
              toolCall.arguments = lastAttempt.action.params;
            }
          }

          const duration = Date.now() - startTime;
          this.recorder.addRecoveryAttempt({
            attempt: attemptNumber,
            strategy:
              errorContext.recoveryHistory[
                errorContext.recoveryHistory.length - 1
              ]?.strategy || 'unknown',
            newSelector: toolCall.arguments.selector,
            result: 'success',
            llmReasoning:
              errorContext.recoveryHistory[
                errorContext.recoveryHistory.length - 1
              ]?.reasoning,
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
    const recentFailures = recentSteps.filter(
      (s) => s.result === 'failed',
    ).length;
    if (recentFailures >= 3) return true;

    return false;
  }

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

  private isInvalidToolCall(step: ExecutionStep): boolean {
    return (
      typeof step.error === 'string' &&
      step.error.startsWith('INVALID_TOOL_CALL:')
    );
  }

  private isInvalidToolCallError(error: Error): boolean {
    return error.message.startsWith('INVALID_TOOL_CALL:');
  }

  private isInvalidRecoveryPlan(reason?: string): boolean {
    return (
      typeof reason === 'string' && reason.startsWith('INVALID_RECOVERY_PLAN:')
    );
  }

  getRecorderStats() {
    return this.recorder.getStats();
  }
}
