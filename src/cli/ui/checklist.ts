import chalk from 'chalk';

export class PlanChecklist {
  private steps: string[];
  private lastMarked: number = -1;

  constructor(steps: string[]) {
    this.steps = steps;
  }

  render(): void {
    if (this.steps.length === 0) return;
    console.log(chalk.blue('\nExecution Plan:'));
    for (let i = 0; i < this.steps.length; i++) {
      console.log(`  ${chalk.gray('○')} ${chalk.gray(`${i + 1}. ${this.steps[i]}`)}`);
    }
    console.log('');
  }

  // Proportionally advance checklist based on executor step progress
  advance(executorStep: number, maxSteps: number): void {
    if (this.steps.length === 0) return;
    const planIndex = Math.min(
      Math.floor((executorStep / maxSteps) * this.steps.length),
      this.steps.length - 1,
    );
    for (let i = this.lastMarked + 1; i <= planIndex; i++) {
      console.log(`\n  ${chalk.green('✓')} ${chalk.green.dim(`[Plan ${i + 1}/${this.steps.length}]`)} ${chalk.dim(this.steps[i])}`);
    }
    this.lastMarked = Math.max(this.lastMarked, planIndex);
  }

  // Mark all remaining steps complete (called at execution end)
  completeAll(): void {
    if (this.steps.length === 0) return;

    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log(chalk.bold('\n  Completed Plan:\n'));
    for (let i = 0; i < this.steps.length; i++) {
      console.log(`  ${chalk.green('✓')} ${i + 1}. ${this.steps[i]}`);
    }
    console.log('');
  }
}
