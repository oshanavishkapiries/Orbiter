import { ErrorContext, RecoveryPlan } from './types.js';

export class RecoveryPromptBuilder {
  /**
   * Build prompt for LLM recovery
   */
  static build(context: ErrorContext): string {
    const {
      error,
      failedAction,
      browserState,
      executionState,
      recoveryHistory,
    } = context;

    const previousAttemptsText =
      recoveryHistory.length > 0
        ? `
PREVIOUS RECOVERY ATTEMPTS (all failed):
${recoveryHistory
  .map(
    r => `  Attempt ${r.attemptNumber}: ${r.strategy}
    Action: ${r.action?.tool} with ${JSON.stringify(r.action?.params)}
    Reason: ${r.reasoning}
    Error: ${r.error}`
  )
  .join('\n')}`
        : '';

    const specialConditions = [];
    if (browserState.domSummary.hasCaptcha) {
      specialConditions.push('⚠️  CAPTCHA DETECTED on page');
    }
    if (browserState.domSummary.hasModal) {
      specialConditions.push('⚠️  MODAL/DIALOG is open');
    }
    if (browserState.domSummary.hasOverlay) {
      specialConditions.push('⚠️  OVERLAY/POPUP present');
    }

    return `You are helping recover from a browser automation error.

═══════════════════════════════════════════════
ERROR DETAILS
═══════════════════════════════════════════════
Type: ${error.type}
Severity: ${error.severity}
Message: ${error.message}

FAILED ACTION:
  Tool: ${failedAction.tool}
  Params: ${JSON.stringify(failedAction.params, null, 2)}
  Attempt: #${failedAction.attemptNumber}

═══════════════════════════════════════════════
CURRENT PAGE STATE
═══════════════════════════════════════════════
URL: ${browserState.url}
Title: ${browserState.title}
Screenshot: ${browserState.screenshotPath}
Network: ${browserState.networkState.status}
${specialConditions.length > 0 ? '\n' + specialConditions.join('\n') : ''}

AVAILABLE CLICKABLE ELEMENTS (top 20):
${browserState.domSummary.clickableElements.slice(0, 20).join('\n') || '  (none found)'}

AVAILABLE INPUT FIELDS:
${browserState.domSummary.inputFields.join('\n') || '  (none found)'}

═══════════════════════════════════════════════
EXECUTION CONTEXT
═══════════════════════════════════════════════
Original goal: ${executionState.originalGoal}
Current step: ${executionState.stepNumber}/${executionState.totalSteps}

Last 5 successful steps:
${executionState.previousSteps
  .slice(-5)
  .map(
    s =>
      `  Step ${s.step}: ${s.tool} (${s.result})${s.selector ? ` → ${s.selector}` : ''}`
  )
  .join('\n') || '  (none yet)'}
${previousAttemptsText}

═══════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════
Analyze the error and provide a recovery plan.

Available recovery strategies:
1. try_alternative_selector - Use a different CSS selector
2. wait_and_retry - Wait longer then retry same action
3. refresh_and_retry - Reload page then retry
4. scroll_and_retry - Scroll to find element then retry
5. wait_for_element - Wait for specific element to appear
6. dismiss_overlay - Close popup/modal first then retry
7. navigate_alternative - Try a different URL/path
8. abort_with_partial - Stop but return what we have so far
9. abort - Stop execution completely

Respond with a JSON recovery plan:
{
  "strategy": "<strategy_name>",
  "reasoning": "<why this will work>",
  "confidence": "high|medium|low",
  "action": {
    "tool": "<tool_name>",
    "params": { ... }
  },
  "waitBeforeRetry": <milliseconds or null>,
  "alternativeSelectors": ["<sel1>", "<sel2>"],
  "shouldAbort": false,
  "abortReason": null
}

IMPORTANT:
- If captcha detected → abort (we cannot solve captchas)
- If 3+ recovery attempts failed → abort_with_partial
- If login required → abort with explanation
- Be specific with alternative selectors based on available elements
- Only suggest actions with high chance of success`;
  }
}