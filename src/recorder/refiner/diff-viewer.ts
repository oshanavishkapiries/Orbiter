import chalk from 'chalk';
import { FlowStep } from '../schema.js';
import { CleanupReport } from './types.js';

export class FlowDiffViewer {
  /**
   * Display before/after diff
   */
  displayDiff(
    originalSteps: FlowStep[],
    cleanedSteps: FlowStep[],
    report: CleanupReport,
  ): void {
    console.log('\n' + chalk.bold('📊 CLEANUP REPORT'));
    console.log(chalk.gray('─'.repeat(60)));

    // Stats
    const reduction = (
      ((report.originalStepCount - report.cleanedStepCount) /
        report.originalStepCount) *
      100
    ).toFixed(0);

    console.log(`  Original steps:  ${chalk.yellow(report.originalStepCount)}`);
    console.log(`  Cleaned steps:   ${chalk.green(report.cleanedStepCount)}`);
    console.log(`  Reduction:       ${chalk.green(reduction + '%')}`);

    // Rules applied
    if (report.rules.length > 0) {
      console.log('\n' + chalk.bold('Rules applied:'));
      for (const rule of report.rules) {
        console.log(
          `  ${chalk.cyan('•')} ${this.formatRuleName(rule.rule)}` +
            chalk.gray(` (${rule.stepsAffected} steps affected)`),
        );
      }
    }

    // Removed steps
    if (report.removedSteps.length > 0) {
      console.log('\n' + chalk.bold('Removed steps:'));
      for (const removed of report.removedSteps) {
        console.log(
          `  ${chalk.red('✖')} Step ${removed.stepId}: ` +
            chalk.cyan(removed.tool) +
            chalk.gray(` - ${removed.reason}`),
        );
      }
    }

    // Merged steps
    if (report.mergedSteps.length > 0) {
      console.log('\n' + chalk.bold('Merged steps:'));
      for (const merged of report.mergedSteps) {
        console.log(
          `  ${chalk.yellow('⟳')} Steps [${merged.fromStepIds.join(', ')}] → ` +
            `Step ${merged.toStepId}: ` +
            chalk.gray(merged.reason),
        );
      }
    }
  }

  /**
   * Display LLM optimization suggestions
   */
  displaySuggestions(suggestions: string[]): void {
    if (suggestions.length === 0) return;

    console.log('\n' + chalk.bold('💡 LLM Suggestions Applied:'));
    for (const suggestion of suggestions) {
      console.log(`  ${chalk.cyan('•')} ${suggestion}`);
    }
  }

  /**
   * Display final step list
   */
  displayFinalSteps(steps: any[]): void {
    console.log('\n' + chalk.bold(`📋 Final Flow (${steps.length} steps):`));
    console.log(chalk.gray('─'.repeat(60)));

    for (const step of steps) {
      const selector = step.params?.selector || step.selector || '';
      const selectorText = selector ? chalk.gray(` → ${selector}`) : '';
      const fallbacks =
        step.selectors && step.selectors.length > 1
          ? chalk.gray(` [+${step.selectors.length - 1} fallback(s)]`)
          : '';

      console.log(
        `  ${chalk.gray(String(step.id).padStart(2, '0'))}.` +
          ` ${chalk.cyan(step.tool)}` +
          selectorText +
          fallbacks,
      );
    }
  }

  /**
   * Format rule name for display
   */
  private formatRuleName(rule: string): string {
    return rule
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
