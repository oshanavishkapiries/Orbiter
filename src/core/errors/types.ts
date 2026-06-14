export type ErrorType =
  | 'element_not_found'
  | 'element_not_interactable'
  | 'timeout'
  | 'navigation_failed'
  | 'network_error'
  | 'element_detached'
  | 'javascript_error'
  | 'captcha_detected'
  | 'selector_mismatch'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecoveryStrategy =
  | 'wait_and_retry'
  | 'refresh_and_retry'
  | 'scroll_and_retry'
  | 'dismiss_overlay'
  | 'navigate_alternative'
  | 'abort_with_partial'
  | 'abort';

export interface PageFlags {
  hasModal: boolean;
  hasOverlay: boolean;
  hasCaptcha: boolean;
}

export interface BrowserStateSnapshot {
  url: string;
  title: string;
  ariaSnapshot: string;
  pageFlags: PageFlags;
  screenshotPath: string;
}

export interface ExecutionSnapshot {
  originalGoal: string;
  stepNumber: number;
  totalSteps: number;
  previousSteps: Array<{
    step: number;
    tool: string;
    result: 'success' | 'failed';
  }>;
  tokensUsedSoFar: number;
}

export interface ErrorContext {
  errorId: string;
  timestamp: number;
  error: {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
  };
  failedAction: {
    tool: string;
    params: Record<string, any>;
    attemptNumber: number;
  };
  browserState: BrowserStateSnapshot;
  executionState: ExecutionSnapshot;
  recoveryHistory: RecoveryAttemptRecord[];
}

export interface RecoveryAttemptRecord {
  attemptNumber: number;
  strategy: RecoveryStrategy;
  reasoning: string;
  action?: { tool: string; params: Record<string, any> };
  result: 'success' | 'failed';
  error?: string;
  timestamp: number;
}

export interface RecoveryPlan {
  strategy: RecoveryStrategy;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  action?: { tool: string; params: Record<string, any> };
  waitBeforeRetry?: number;
  shouldAbort: boolean;
  abortReason?: string;
}
