import os from 'os';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { generateFlowId, generateId } from '../utils/id.js';
import { DataRepository } from '../memory/database/repositories/data-repository.js';
import {
  Flow,
  FlowStep,
  FlowStepAction,
  FlowStepResult,
  FlowStepError,
  FlowStepMetadata,
  FlowMetadata,
  FlowParameter,
  RecoveryAttempt,
} from './schema.js';

export class FlowRecorder {
  private flow: Flow;
  private stepCounter = 0;
  private isRecording = false;
  private currentUrl = '';
  private currentTitle = '';
  private sessionId: string | null = null;
  private dataRepo: DataRepository | null = null;

  constructor(prompt: string, llmProvider: string, llmModel: string) {
    const flowId = generateFlowId();

    this.flow = {
      id: flowId,
      name: this.generateFlowName(prompt),
      description: prompt,
      version: 1,
      type: 'raw',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parameters: [],
      steps: [],
      metadata: {
        originalPrompt: prompt,
        plannedSteps: 0,
        llmProvider,
        llmModel,
        totalTokensUsed: 0,
        estimatedCost: 0,
        headless: config().browser.headless,
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        recoveredSteps: 0,
        screenshotPaths: [],
        platform: os.platform(),
        nodeVersion: process.version,
        orbiterVersion: '1.0.0',
      },
    };
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  setDataRepo(repo: DataRepository): void {
    this.dataRepo = repo;
  }

  start(): void {
    this.isRecording = true;
    logger.debug(`Flow recording started (id: ${this.flow.id})`);
  }

  stop(): void {
    this.isRecording = false;
    this.flow.updatedAt = Date.now();
    this.flow.metadata.totalSteps = this.flow.steps.length;
    logger.debug('Flow recording stopped');
  }

  updatePageContext(url: string, title: string): void {
    this.currentUrl = url;
    this.currentTitle = title;
  }

  recordSuccess(
    tool: string,
    params: Record<string, any>,
    result: FlowStepResult,
    duration: number,
    metadata?: FlowStepMetadata,
  ): FlowStep {
    if (!this.isRecording) return this.createDummyStep();

    this.stepCounter++;

    const step: FlowStep = {
      id: this.stepCounter,
      rawId: generateId('step'),
      action: tool as FlowStepAction,
      tool,
      params,
      selector: params.selector,
      status: 'success',
      result,
      timestamp: Date.now(),
      duration,
      context: {
        url: this.currentUrl,
        pageTitle: this.currentTitle,
      },
      metadata: metadata || { wasRetry: false },
    };

    this.flow.steps.push(step);
    this.flow.metadata.successfulSteps++;

    if (result.screenshot) {
      this.flow.metadata.screenshotPaths.push(result.screenshot);
    }

    logger.debug(`Recorded step ${step.id}: ${tool} (success)`);
    return step;
  }

  recordFailure(
    tool: string,
    params: Record<string, any>,
    error: FlowStepError,
    duration: number,
    metadata?: FlowStepMetadata,
  ): FlowStep {
    if (!this.isRecording) return this.createDummyStep();

    this.stepCounter++;

    const step: FlowStep = {
      id: this.stepCounter,
      rawId: generateId('step'),
      action: tool as FlowStepAction,
      tool,
      params,
      selector: params.selector,
      status: 'failed',
      error,
      timestamp: Date.now(),
      duration,
      context: {
        url: this.currentUrl,
        pageTitle: this.currentTitle,
      },
      metadata: metadata || { wasRetry: false },
      recoveryAttempts: [],
    };

    this.flow.steps.push(step);
    this.flow.metadata.failedSteps++;

    if (error.screenshot) {
      this.flow.metadata.screenshotPaths.push(error.screenshot);
    }

    logger.debug(`Recorded step ${step.id}: ${tool} (failed)`);
    return step;
  }

  addRecoveryAttempt(attempt: RecoveryAttempt): void {
    const lastFailedStep = [...this.flow.steps]
      .reverse()
      .find((s) => s.status === 'failed');

    if (lastFailedStep) {
      if (!lastFailedStep.recoveryAttempts) {
        lastFailedStep.recoveryAttempts = [];
      }
      lastFailedStep.recoveryAttempts.push(attempt);

      if (attempt.result === 'success') {
        this.flow.metadata.recoveredSteps++;
      }
    }
  }

  updateTokenUsage(tokens: number): void {
    this.flow.metadata.totalTokensUsed += tokens;
    this.flow.metadata.estimatedCost =
      (this.flow.metadata.totalTokensUsed / 1_000_000) * 3;
  }

  detectParameters(params: Record<string, any>): void {
    const paramRegex = /\{\{([A-Z_]+)\}\}/g;

    for (const value of Object.values(params)) {
      if (typeof value !== 'string') continue;

      let match;
      while ((match = paramRegex.exec(value)) !== null) {
        const paramName = match[1];
        const exists = this.flow.parameters.some((p) => p.name === paramName);

        if (!exists) {
          this.flow.parameters.push({
            name: paramName,
            required: true,
            type: 'string',
          });
          logger.debug(`Detected parameter: {{${paramName}}}`);
        }
      }
    }
  }

  async save(): Promise<string> {
    this.flow.updatedAt = Date.now();

    if (this.dataRepo) {
      try {
        const id = await this.dataRepo.saveFlow(this.flow, this.sessionId);
        logger.success(
          `Flow saved to database (id: ${id}, ${this.flow.steps.length} steps)`,
        );
        return id;
      } catch (err) {
        logger.warn(
          `Failed to save flow to database: ${(err as Error).message}`,
        );
      }
    }

    logger.warn('Flow not persisted (database unavailable)');
    return this.flow.id;
  }

  getFlow(): Flow {
    return this.flow;
  }

  getFlowId(): string {
    return this.flow.id;
  }

  getFlowName(): string {
    return this.flow.name;
  }

  private generateFlowName(prompt: string): string {
    return prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-');
  }

  private createDummyStep(): FlowStep {
    return {
      id: -1,
      rawId: 'dummy',
      action: 'navigate',
      tool: 'unknown',
      params: {},
      status: 'skipped',
      timestamp: Date.now(),
      duration: 0,
      context: { url: '', pageTitle: '' },
    };
  }

  getStats(): {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    recoveredSteps: number;
    totalTokens: number;
    estimatedCost: string;
  } {
    return {
      totalSteps: this.flow.steps.length,
      successfulSteps: this.flow.metadata.successfulSteps,
      failedSteps: this.flow.metadata.failedSteps,
      recoveredSteps: this.flow.metadata.recoveredSteps,
      totalTokens: this.flow.metadata.totalTokensUsed,
      estimatedCost: `$${this.flow.metadata.estimatedCost.toFixed(4)}`,
    };
  }
}
