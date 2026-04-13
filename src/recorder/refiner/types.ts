export type CleanupRuleType =
  | 'remove_failed_attempts'
  | 'remove_debug_screenshots'
  | 'merge_consecutive_types'
  | 'remove_redundant_waits'
  | 'remove_duplicate_navigations'
  | 'remove_skipped_steps'
  | 'merge_fill_actions';

export interface CleanupRule {
  type: CleanupRuleType;
  description: string;
  enabled: boolean;
}

export interface CleanupReport {
  originalStepCount: number;
  cleanedStepCount: number;
  removedSteps: RemovedStep[];
  mergedSteps: MergedStep[];
  rules: AppliedRule[];
}

export interface RemovedStep {
  stepId: number;
  tool: string;
  reason: string;
}

export interface MergedStep {
  fromStepIds: number[];
  toStepId: number;
  reason: string;
}

export interface AppliedRule {
  rule: CleanupRuleType;
  stepsAffected: number;
}

export interface SelectorSuggestion {
  original: string;
  suggested: string;
  reason: string;
  stability: 'high' | 'medium' | 'low';
}

export interface OptimizedStep {
  id: number;
  tool: string;
  params: Record<string, any>;
  selectors?: string[];
  selectorStrategy?: 'first_match' | 'try_all';
  reasoning?: string;
  isParameterized?: boolean;
}

export interface OptimizedFlow {
  id: string;
  name: string;
  description: string;
  version: number;
  type: 'optimized';
  createdAt: number;
  updatedAt: number;
  parameters: any[];
  steps: OptimizedStep[];
  metadata: {
    originalFlowId: string;
    originalStepCount: number;
    optimizedStepCount: number;
    reductionPercent: number;
    optimizedAt: number;
    optimizationMethod: string[];
    estimatedReplayTime: number;
  };
}

export interface RefineOptions {
  autoClean: boolean;
  llmOptimize: boolean;
  interactive: boolean;
  outputPath?: string;
  dryRun: boolean;
}

export interface InteractiveAction {
  stepId: number;
  action: 'keep' | 'remove' | 'edit' | 'skip';
  newParams?: Record<string, any>;
}
