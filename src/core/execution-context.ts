import { BrowserManager } from '../browser/manager.js';
import { PageUtils } from '../browser/page-utils.js';
import { logger } from '../cli/ui/logger.js';

export interface ExecutionState {
  currentStep: number;
  totalSteps: number;
  startTime: number;
  collectedData: Record<string, any>;
  history: ExecutionHistoryItem[];
}

export interface ExecutionHistoryItem {
  step: number;
  action: string;
  target?: string;
  result: 'success' | 'failed';
  error?: string;
  timestamp: number;
  duration: number;
}

export class ExecutionContext {
  private browserManager: BrowserManager;
  private pageUtils: PageUtils | null = null;
  private state: ExecutionState;

  constructor() {
    this.browserManager = new BrowserManager();
    this.state = {
      currentStep: 0,
      totalSteps: 0,
      startTime: Date.now(),
      collectedData: {},
      history: [],
    };
  }

  /**
   * Initialize browser
   */
  async initialize(options?: any): Promise<void> {
    logger.info('Initializing execution context...');

    await this.browserManager.launch(options);
    const page = this.browserManager.getPage();
    this.pageUtils = new PageUtils(page);

    logger.success('Execution context initialized');
  }

  /**
   * Get browser manager
   */
  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  /**
   * Get page utils
   */
  getPageUtils(): PageUtils {
    if (!this.pageUtils) {
      throw new Error('Execution context not initialized');
    }
    return this.pageUtils;
  }

  /**
   * Get current state
   */
  getState(): ExecutionState {
    return this.state;
  }

  /**
   * Set total steps
   */
  setTotalSteps(total: number): void {
    this.state.totalSteps = total;
  }

  /**
   * Record step execution
   */
  recordStep(action: string, target: string | undefined, result: 'success' | 'failed', error?: string): void {
    const now = Date.now();
    const lastTimestamp = this.state.history.length > 0
      ? this.state.history[this.state.history.length - 1].timestamp
      : this.state.startTime;

    this.state.history.push({
      step: this.state.currentStep,
      action,
      target,
      result,
      error,
      timestamp: now,
      duration: now - lastTimestamp,
    });

    this.state.currentStep++;
  }

  /**
   * Store data
   */
  storeData(key: string, value: any): void {
    this.state.collectedData[key] = value;
  }

  /**
   * Get stored data
   */
  getData(key: string): any {
    return this.state.collectedData[key];
  }

  /**
   * Get last N successful steps
   */
  getLastSuccessfulSteps(n: number): ExecutionHistoryItem[] {
    return this.state.history.filter((item) => item.result === 'success').slice(-n);
  }

  /**
   * Get execution summary
   */
  getSummary(): {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    duration: number;
  } {
    const successful = this.state.history.filter((h) => h.result === 'success').length;
    const failed = this.state.history.filter((h) => h.result === 'failed').length;

    return {
      totalSteps: this.state.history.length,
      successfulSteps: successful,
      failedSteps: failed,
      duration: Date.now() - this.state.startTime,
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up execution context...');
    await this.browserManager.close();
    logger.success('Execution context cleaned up');
  }
}