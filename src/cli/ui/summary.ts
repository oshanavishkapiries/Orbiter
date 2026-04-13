import chalk from 'chalk';
import boxen from 'boxen';

export interface ExecutionSummary {
  success: boolean;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  recoveredSteps?: number;
  duration: number;
  tokensUsed: number;
  estimatedCost: number;
  flowPath?: string;
  outputFiles?: string[];
  extractedItems?: number;
}

export interface ReplaySummary {
  flowName: string;
  success: boolean;
  stepsExecuted: number;
  stepsFailed: number;
  duration: number;
  outputFiles?: string[];
  extractedItems?: number;
  originalCost: number;
}

export interface LoopSummary {
  taskName: string;
  success: boolean;
  totalItems: number;
  failedItems: number;
  pagesProcessed: number;
  duration: number;
  estimatedSavings: string;
}

export const summaries = {
  /**
   * Execution summary
   */
  execution(data: ExecutionSummary): void {
    const status = data.success
      ? chalk.green.bold('✅ TASK COMPLETED SUCCESSFULLY')
      : chalk.yellow.bold('⚠️  TASK COMPLETED WITH ERRORS');

    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log('\n' + status + '\n');

    // Results box
    const resultsContent = [
      `${chalk.bold('Results:')}`,
      `  Steps executed:  ${data.successfulSteps}/${data.totalSteps}`,
      data.failedSteps > 0
        ? `  ${chalk.red('Steps failed:')}   ${data.failedSteps}`
        : '',
      data.recoveredSteps
        ? `  ${chalk.yellow('Steps recovered:')} ${data.recoveredSteps}`
        : '',
      data.extractedItems
        ? `  ${chalk.green('Items extracted:')} ${data.extractedItems}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    console.log(resultsContent);

    // Performance box
    const cost = data.estimatedCost.toFixed(4);
    console.log('\n' + chalk.bold('Performance:'));
    console.log(`  Duration:     ${formatDuration(data.duration)}`);
    console.log(`  LLM tokens:   ${data.tokensUsed.toLocaleString()}`);
    console.log(`  LLM cost:     ${chalk.yellow('$' + cost)}`);

    // Output files
    if (data.outputFiles && data.outputFiles.length > 0) {
      console.log('\n' + chalk.bold('Output files:'));
      for (const file of data.outputFiles) {
        console.log(`  📄 ${chalk.gray(file)}`);
      }
    }

    // Flow path
    if (data.flowPath) {
      console.log('\n' + chalk.bold('Flow recorded:'));
      console.log(`  📝 ${chalk.gray(data.flowPath)}`);
    }

    // Next steps
    if (data.flowPath) {
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(
        `  ${chalk.gray('•')} Optimize: ${chalk.cyan('orbiter refine ' + data.flowPath)}`,
      );
      const replayPath = data.flowPath.replace('.raw.json', '.flow.json');
      console.log(
        `  ${chalk.gray('•')} Replay:   ${chalk.cyan('orbiter replay ' + replayPath)}`,
      );
    }

    console.log('');
  },

  /**
   * Replay summary
   */
  replay(data: ReplaySummary): void {
    const status = data.success
      ? chalk.green.bold('✅ REPLAY COMPLETED SUCCESSFULLY')
      : chalk.yellow.bold('⚠️  REPLAY COMPLETED WITH ERRORS');

    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log('\n' + status + '\n');

    console.log(chalk.bold('Results:'));
    console.log(`  Flow:           ${chalk.cyan(data.flowName)}`);
    console.log(`  Steps executed: ${data.stepsExecuted}`);

    if (data.stepsFailed > 0) {
      console.log(`  ${chalk.red('Steps failed:')}   ${data.stepsFailed}`);
    }

    if (data.extractedItems) {
      console.log(
        `  ${chalk.green('Items extracted:')} ${data.extractedItems}`,
      );
    }

    // Output files
    if (data.outputFiles && data.outputFiles.length > 0) {
      console.log('\n' + chalk.bold('Output files:'));
      for (const file of data.outputFiles) {
        console.log(`  📄 ${chalk.gray(file)}`);
      }
    }

    // Performance comparison
    console.log('\n' + chalk.bold('Performance:'));
    console.log(`  Duration:    ${formatDuration(data.duration)}`);
    console.log(`  LLM calls:   ${chalk.green('0')} (replay mode)`);
    console.log(`  Replay cost: ${chalk.green('$0.00')}`);

    if (data.originalCost > 0) {
      console.log(`\n${chalk.bold('Savings vs original:')} `);
      console.log(
        `  Original cost: ${chalk.yellow('$' + data.originalCost.toFixed(4))}`,
      );
      console.log(`  ${chalk.green.bold('Cost saved: 100% 💰')}`);
    }

    console.log('');
  },

  /**
   * Loop Engine summary
   */
  loop(data: LoopSummary): void {
    const status = data.success
      ? chalk.green.bold('✅ LOOP ENGINE COMPLETE')
      : chalk.yellow.bold('⚠️  LOOP ENGINE COMPLETED WITH ERRORS');

    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log('\n' + status + '\n');

    console.log(chalk.bold('Results:'));
    console.log(`  Items extracted: ${chalk.green(data.totalItems)}`);

    if (data.failedItems > 0) {
      console.log(`  ${chalk.red('Items failed:')}   ${data.failedItems}`);
    }

    console.log(`  Pages processed: ${data.pagesProcessed}`);
    console.log(`  Duration:        ${formatDuration(data.duration)}`);

    console.log('\n' + chalk.bold('Performance:'));
    console.log(`  LLM calls in loop: ${chalk.green('0')}`);
    console.log(`  Loop cost:         ${chalk.green('$0.00')}`);
    console.log(
      `  Estimated savings: ${chalk.green(data.estimatedSavings)} 💰`,
    );

    console.log('');
  },

  /**
   * Quick stats line
   */
  quickStats(
    steps: number,
    duration: number,
    tokens: number,
    cost: number,
  ): void {
    console.log(
      chalk.gray(
        `  📊 ${steps} steps | ${formatDuration(duration)} | ` +
          `${tokens.toLocaleString()} tokens | $${cost.toFixed(4)}`,
      ),
    );
  },
};

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
}
