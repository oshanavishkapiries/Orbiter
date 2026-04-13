import { FlowStep } from '../schema.js';
import { logger } from '../../cli/ui/logger.js';
import {
  CleanupReport,
  RemovedStep,
  MergedStep,
  AppliedRule,
  CleanupRuleType,
} from './types.js';

export class AutoCleaner {
  private removedSteps: RemovedStep[] = [];
  private mergedSteps: MergedStep[] = [];
  private appliedRules: AppliedRule[] = [];

  /**
   * Run all cleanup rules on steps
   */
  clean(steps: FlowStep[]): {
    steps: FlowStep[];
    report: CleanupReport;
  } {
    const originalCount = steps.length;
    let cleaned = [...steps];

    logger.debug(`Auto-clean starting with ${originalCount} steps`);

    // Apply rules in order
    cleaned = this.removeFailedAttempts(cleaned);
    cleaned = this.removeDebugScreenshots(cleaned);
    cleaned = this.removeDuplicateNavigations(cleaned);
    cleaned = this.removeRedundantWaits(cleaned);
    cleaned = this.mergeConsecutiveTypes(cleaned);
    cleaned = this.mergeFillActions(cleaned);
    cleaned = this.removeSkippedSteps(cleaned);

    // Re-index steps
    cleaned = cleaned.map((step, index) => ({
      ...step,
      id: index + 1,
    }));

    const report: CleanupReport = {
      originalStepCount: originalCount,
      cleanedStepCount: cleaned.length,
      removedSteps: this.removedSteps,
      mergedSteps: this.mergedSteps,
      rules: this.appliedRules,
    };

    logger.debug(
      `Auto-clean complete: ${originalCount} → ${cleaned.length} steps`,
    );

    return { steps: cleaned, report };
  }

  /**
   * Rule 1: Remove failed attempts
   * Keep only the successful recovery, remove the failed original
   */
  private removeFailedAttempts(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (const step of steps) {
      if (step.status === 'failed') {
        // Check if there's a successful retry for this step
        const hasSuccessfulRecovery =
          step.recoveryAttempts?.some((r) => r.result === 'success') || false;

        // Check if next step is a successful retry
        const stepIndex = steps.indexOf(step);
        const nextStep = steps[stepIndex + 1];
        const hasSuccessfulNextStep =
          nextStep &&
          nextStep.status === 'success' &&
          nextStep.tool === step.tool &&
          nextStep.metadata?.wasRetry === true;

        if (hasSuccessfulRecovery || hasSuccessfulNextStep) {
          toRemove.add(step.id);
          this.removedSteps.push({
            stepId: step.id,
            tool: step.tool,
            reason: 'Failed attempt with successful recovery',
          });
        }
      }
    }

    this.trackRule('remove_failed_attempts', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 2: Remove debug-only screenshots
   */
  private removeDebugScreenshots(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (const step of steps) {
      if (step.tool === 'screenshot' && step.metadata?.isDebugOnly === true) {
        toRemove.add(step.id);
        this.removedSteps.push({
          stepId: step.id,
          tool: step.tool,
          reason: 'Debug-only screenshot',
        });
      }
    }

    this.trackRule('remove_debug_screenshots', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 3: Remove duplicate navigations
   * If we navigate to same URL twice in a row, keep only first
   */
  private removeDuplicateNavigations(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];

      if (
        curr.tool === 'navigate' &&
        prev.tool === 'navigate' &&
        curr.params.url === prev.params.url
      ) {
        toRemove.add(curr.id);
        this.removedSteps.push({
          stepId: curr.id,
          tool: curr.tool,
          reason: `Duplicate navigation to ${curr.params.url}`,
        });
      }
    }

    this.trackRule('remove_duplicate_navigations', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 4: Remove redundant waits
   * Remove waits that are unnecessarily long or consecutive
   */
  private removeRedundantWaits(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step.tool !== 'wait') continue;

      // Remove very long time-based waits (>5s)
      if (step.params.type === 'time' && step.params.duration > 5000) {
        // Replace with reasonable wait
        step.params.duration = 2000;
        this.removedSteps.push({
          stepId: step.id,
          tool: step.tool,
          reason: `Reduced excessive wait from ${step.params.duration}ms to 2000ms`,
        });
        continue;
      }

      // Remove consecutive waits - merge them
      if (i > 0 && steps[i - 1].tool === 'wait') {
        const prev = steps[i - 1];

        if (prev.params.type === 'time' && step.params.type === 'time') {
          // Merge: keep previous with combined time (capped at 3s)
          prev.params.duration = Math.min(
            (prev.params.duration || 0) + (step.params.duration || 0),
            3000,
          );
          toRemove.add(step.id);
          this.removedSteps.push({
            stepId: step.id,
            tool: step.tool,
            reason: 'Consecutive wait merged into previous',
          });
        }
      }
    }

    this.trackRule('remove_redundant_waits', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 5: Merge consecutive type actions on same element
   */
  private mergeConsecutiveTypes(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];

      if (
        curr.tool === 'type' &&
        prev.tool === 'type' &&
        curr.params.selector === prev.params.selector
      ) {
        // Merge text
        prev.params.text = (prev.params.text || '') + (curr.params.text || '');
        prev.tool = 'fill'; // Use fill for merged text

        toRemove.add(curr.id);
        this.mergedSteps.push({
          fromStepIds: [prev.id, curr.id],
          toStepId: prev.id,
          reason: 'Consecutive type actions merged into fill',
        });
      }
    }

    this.trackRule('merge_consecutive_types', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 6: Merge fill then type on same element
   */
  private mergeFillActions(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const curr = steps[i];

      const bothAreInputs =
        ['type', 'fill'].includes(prev.tool) &&
        ['type', 'fill'].includes(curr.tool);

      if (bothAreInputs && curr.params.selector === prev.params.selector) {
        // Keep fill, merge values
        prev.tool = 'fill';
        prev.params.value =
          (prev.params.value || prev.params.text || '') +
          (curr.params.value || curr.params.text || '');
        delete prev.params.text;

        toRemove.add(curr.id);
        this.mergedSteps.push({
          fromStepIds: [prev.id, curr.id],
          toStepId: prev.id,
          reason: 'Fill/type actions merged',
        });
      }
    }

    this.trackRule('merge_fill_actions', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Rule 7: Remove skipped steps
   */
  private removeSkippedSteps(steps: FlowStep[]): FlowStep[] {
    const toRemove = new Set<number>();

    for (const step of steps) {
      if (step.status === 'skipped') {
        toRemove.add(step.id);
        this.removedSteps.push({
          stepId: step.id,
          tool: step.tool,
          reason: 'Step was skipped during recording',
        });
      }
    }

    this.trackRule('remove_skipped_steps', toRemove.size);
    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Track rule application
   */
  private trackRule(rule: CleanupRuleType, affected: number): void {
    if (affected > 0) {
      this.appliedRules.push({ rule, stepsAffected: affected });
    }
  }
}
