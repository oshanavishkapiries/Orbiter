import { ErrorContext } from './types.js';

export class RecoveryPromptBuilder {
  static build(context: ErrorContext): string {
    const { error, failedAction, browserState, executionState, recoveryHistory } = context;

    const warnings: string[] = [];
    if (browserState.pageFlags.hasCaptcha) warnings.push('CAPTCHA DETECTED — abort immediately');
    if (browserState.pageFlags.hasModal)   warnings.push('A modal/dialog is open');
    if (browserState.pageFlags.hasOverlay) warnings.push('An overlay or popup is present');

    const priorAttempts = recoveryHistory.length > 0
      ? `\nPREVIOUS RECOVERY ATTEMPTS (all failed):\n` +
        recoveryHistory.map(r =>
          `  Attempt ${r.attemptNumber}: ${r.strategy} — ${r.reasoning}\n  Error: ${r.error}`
        ).join('\n')
      : '';

    return `You are recovering from a browser automation error.

ERROR
  Type:     ${error.type}
  Severity: ${error.severity}
  Message:  ${error.message}

FAILED ACTION
  Tool:    ${failedAction.tool}
  Params:  ${JSON.stringify(failedAction.params)}
  Attempt: #${failedAction.attemptNumber}

PAGE STATE
  URL:   ${browserState.url}
  Title: ${browserState.title}
${warnings.length ? '\nWARNINGS:\n' + warnings.map(w => '  ⚠ ' + w).join('\n') : ''}

ACCESSIBILITY SNAPSHOT (current page):
${browserState.ariaSnapshot || '  (unavailable)'}

EXECUTION CONTEXT
  Goal:  ${executionState.originalGoal}
  Step:  ${executionState.stepNumber}/${executionState.totalSteps}
  Prior steps: ${executionState.previousSteps.map(s => `${s.tool}(${s.result})`).join(' → ')}
${priorAttempts}

RECOVERY STRATEGIES (pick one):
  wait_and_retry       — wait then retry the same action
  refresh_and_retry    — reload the page then retry
  scroll_and_retry     — scroll down to expose the element then retry
  dismiss_overlay      — close a modal/popup then retry
  navigate_alternative — try a different URL
  abort_with_partial   — stop but preserve any data collected so far
  abort                — stop completely

Respond with JSON:
{
  "strategy": "<strategy>",
  "reasoning": "<why this will work>",
  "confidence": "high|medium|low",
  "action": { "tool": "<tool>", "params": { ... } },
  "waitBeforeRetry": <ms or null>,
  "shouldAbort": false,
  "abortReason": null
}

Rules:
- captcha detected → always abort
- 3+ failed attempts → abort_with_partial
- Use the accessibility snapshot to choose correct semantic locators in any action params`;
  }
}
