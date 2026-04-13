import readline from 'readline';
import chalk from 'chalk';
import { FlowStep } from '../schema.js';
import { InteractiveAction } from './types.js';
import { logger } from '../../cli/ui/logger.js';

export class InteractiveReviewer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Run interactive review session
   */
  async review(steps: FlowStep[]): Promise<FlowStep[]> {
    console.log('\n' + chalk.cyan.bold('📋 INTERACTIVE FLOW REVIEW'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(`Total steps: ${steps.length}`));
    console.log(
      chalk.gray('Commands: [K]eep  [R]emove  [E]dit selector  [D]one\n'),
    );

    const actions: InteractiveAction[] = [];
    const toRemove = new Set<number>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isFailed = step.status === 'failed';

      // Display step info
      this.displayStep(step, i + 1, steps.length);

      // Get user action
      const action = await this.promptAction(
        isFailed
          ? '[R]emove / [K]eep: '
          : '[K]eep / [R]emove / [E]dit / [D]one: ',
      );

      if (action === 'd') {
        console.log(chalk.gray('\nDone reviewing. Keeping remaining steps.'));
        break;
      }

      if (action === 'r') {
        toRemove.add(step.id);
        console.log(chalk.red(`  ✖ Step ${step.id} marked for removal`));
        actions.push({ stepId: step.id, action: 'remove' });
      } else if (action === 'e') {
        const newSelector = await this.promptInput(
          `  New selector (current: ${step.selector || 'none'}): `,
        );

        if (newSelector && newSelector.trim()) {
          step.params.selector = newSelector.trim();
          step.selector = newSelector.trim();
          console.log(chalk.green(`  ✓ Selector updated`));
          actions.push({
            stepId: step.id,
            action: 'edit',
            newParams: { ...step.params, selector: newSelector.trim() },
          });
        }
      } else {
        console.log(chalk.green(`  ✓ Step ${step.id} kept`));
        actions.push({ stepId: step.id, action: 'keep' });
      }

      console.log('');
    }

    // Summary
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.bold(`Review complete:`));
    console.log(`  Kept:    ${steps.length - toRemove.size} steps`);
    console.log(`  Removed: ${toRemove.size} steps`);

    this.rl.close();

    return steps.filter((s) => !toRemove.has(s.id));
  }

  /**
   * Display step info clearly
   */
  private displayStep(step: FlowStep, current: number, total: number): void {
    const statusColor =
      step.status === 'success'
        ? chalk.green
        : step.status === 'failed'
          ? chalk.red
          : chalk.gray;

    const statusIcon =
      step.status === 'success' ? '✓' : step.status === 'failed' ? '✖' : '○';

    console.log(
      chalk.bold(`Step ${current}/${total}`) + chalk.gray(` [id:${step.id}]`),
    );

    console.log(
      `  ${statusColor(statusIcon)} Tool:   ${chalk.cyan(step.tool)}`,
    );

    if (step.selector) {
      console.log(`  → Selector: ${chalk.gray(step.selector)}`);
    }

    // Show key params
    const displayParams = { ...step.params };
    delete displayParams.selector;

    if (Object.keys(displayParams).length > 0) {
      const paramStr = JSON.stringify(displayParams);
      const truncated =
        paramStr.length > 80 ? paramStr.slice(0, 80) + '...' : paramStr;
      console.log(`  → Params:   ${chalk.gray(truncated)}`);
    }

    if (step.context?.url) {
      console.log(`  → URL:      ${chalk.gray(step.context.url)}`);
    }

    if (step.status === 'failed' && step.error) {
      console.log(`  → Error:    ${chalk.red(step.error.message)}`);
    }

    if (step.recoveryAttempts && step.recoveryAttempts.length > 0) {
      const successful = step.recoveryAttempts.filter(
        (r) => r.result === 'success',
      );
      if (successful.length > 0) {
        console.log(
          `  → Recovery: ${chalk.yellow(`${successful.length} attempt(s) - recovered`)}`,
        );
      }
    }
  }

  /**
   * Prompt for user action
   */
  private promptAction(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.yellow(`  ${question}`), (answer) => {
        resolve(answer.toLowerCase().trim() || 'k');
      });
    });
  }

  /**
   * Prompt for text input
   */
  private promptInput(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.yellow(question), (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
