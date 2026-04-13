// ─────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────

export type ErrorType =
  | 'selector_not_found'
  | 'element_not_interactable'
  | 'timeout'
  | 'navigation_failed'
  | 'network_error'
  | 'unexpected_page'
  | 'captcha_detected'
  | 'login_required'
  | 'rate_limited'
  | 'element_detached'
  | 'javascript_error'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecoveryStrategy =
  | 'try_alternative_selector'
  | 'wait_and_retry'
  | 'refresh_and_retry'
  | 'navigate_alternative'
  | 'scroll_and_retry'
  | 'wait_for_element'
  | 'dismiss_overlay'
  | 'abort_with_partial'
  | 'abort';

// ─────────────────────────────────────────────
// Error Context Types
// ─────────────────────────────────────────────

export interface DomSummary {
  visibleElements: string[];
  clickableElements: string[];
  inputFields: string[];
  formElements: string[];
  iframeCount: number;
  hasOverlay: boolean;
  hasModal: boolean;
  hasCaptcha: boolean;
}

export interface NetworkState {
  status: 'online' | 'slow' | 'offline';
  lastRequestUrl?: string;
  lastResponseStatus?: number;
  pendingRequests: number;
}

export interface BrowserStateSnapshot {
  url: string;
  title: string;
  domSummary: DomSummary;
  screenshotPath: string;
  networkState: NetworkState;
  scrollPosition: { x: number; y: number };
  pageHeight: number;
  viewportHeight: number;
}

export interface ExecutionSnapshot {
  originalGoal: string;
  currentObjective: string;
  stepNumber: number;
  totalSteps: number;
  previousSteps: Array<{
    step: number;
    tool: string;
    action: string;
    result: 'success' | 'failed';
    selector?: string;
  }>;
  collectedData: Record<string, any>;
  tokensUsedSoFar: number;
}

export interface ErrorContext {
  // Identity
  errorId: string;
  timestamp: number;

  // Error details
  error: {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    originalMessage: string;
    stack?: string;
  };

  // What was being attempted
  failedAction: {
    tool: string;
    params: Record<string, any>;
    selector?: string;
    attemptNumber: number;
  };

  // Browser state when error occurred
  browserState: BrowserStateSnapshot;

  // Execution context
  executionState: ExecutionSnapshot;

  // Recovery attempts so far
  recoveryHistory: RecoveryAttemptRecord[];
}

export interface RecoveryAttemptRecord {
  attemptNumber: number;
  strategy: RecoveryStrategy;
  reasoning: string;
  action?: {
    tool: string;
    params: Record<string, any>;
  };
  result: 'success' | 'failed' | 'pending';
  error?: string;
  timestamp: number;
}

export interface RecoveryPlan {
  strategy: RecoveryStrategy;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  action?: {
    tool: string;
    params: Record<string, any>;
  };
  waitBeforeRetry?: number;
  alternativeSelectors?: string[];
  shouldAbort: boolean;
  abortReason?: string;
}
