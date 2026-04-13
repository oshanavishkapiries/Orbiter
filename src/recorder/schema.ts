// ─────────────────────────────────────────────
// Core Flow Types
// ─────────────────────────────────────────────

export type FlowStepStatus = 'success' | 'failed' | 'skipped';

export type FlowStepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'fill'
  | 'scroll'
  | 'hover'
  | 'select_dropdown'
  | 'wait'
  | 'screenshot'
  | 'extract_text'
  | 'extract_data'
  | 'evaluate_js'
  | 'detect_repetitive_pattern'
  | 'loop_extract';

export interface FlowStepMetadata {
  wasRetry: boolean;
  retryOf?: number;
  retryAttempt?: number;
  llmReasoning?: string;
  wasRecovery?: boolean;
  recoveryStrategy?: string;
  isDebugOnly?: boolean;
}

export interface FlowStepError {
  type: string;
  message: string;
  selector?: string;
  screenshot?: string;
}

export interface FlowStepResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  screenshot?: string;
}

export interface FlowStep {
  // Identity
  id: number;
  rawId: string;

  // Action info
  action: FlowStepAction;
  tool: string;
  params: Record<string, any>;

  // Selector info (for quick access)
  selector?: string;

  // Execution result
  status: FlowStepStatus;
  result?: FlowStepResult;
  error?: FlowStepError;

  // Timing
  timestamp: number;
  duration: number;

  // Context at time of execution
  context: {
    url: string;
    pageTitle: string;
  };

  // Metadata
  metadata?: FlowStepMetadata;

  // Recovery info
  recoveryAttempts?: RecoveryAttempt[];
}

export interface RecoveryAttempt {
  attempt: number;
  strategy: string;
  newSelector?: string;
  newParams?: Record<string, any>;
  result: 'success' | 'failed';
  llmReasoning?: string;
  error?: string;
}

export interface FlowMetadata {
  // Original task info
  originalPrompt: string;
  plannedSteps: number;

  // LLM info
  llmProvider: string;
  llmModel: string;
  totalTokensUsed: number;
  estimatedCost: number;

  // Browser info
  browserProfile?: string;
  headless: boolean;
  startUrl?: string;

  // Execution stats
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  recoveredSteps: number;

  // Output
  extractedDataFile?: string;
  screenshotPaths: string[];

  // Environment
  platform: string;
  nodeVersion: string;
  orbiterVersion: string;
}

export interface Flow {
  // Identity
  id: string;
  name: string;
  description?: string;
  version: number;
  type: 'raw' | 'optimized';

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Parameters (for parameterized flows)
  parameters: FlowParameter[];

  // Steps
  steps: FlowStep[];

  // Flow metadata
  metadata: FlowMetadata;

  // Tags for organization
  tags?: string[];
}

export interface FlowParameter {
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
}

// ─────────────────────────────────────────────
// Replay Types
// ─────────────────────────────────────────────

export interface ReplayOptions {
  parameters?: Record<string, string>;
  parametersFile?: string;
  headless?: boolean;
  profilePath?: string;
  skipSteps?: number[];
  stopOnError?: boolean;
  screenshotOnStep?: boolean;
}

export interface ReplayResult {
  flowId: string;
  flowName: string;
  success: boolean;
  stepsExecuted: number;
  stepsFailed: number;
  duration: number;
  extractedData?: any[];
  outputFiles?: string[];
  errors: Array<{
    stepId: number;
    error: string;
  }>;
}
