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
  flowId?: string;
  outputs?: string[];
  extractedItems?: number;
}

export interface ReplaySummary {
  flowName: string;
  success: boolean;
  stepsExecuted: number;
  stepsFailed: number;
  duration: number;
  outputs?: string[];
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
    const isSuccess = data.success && data.failedSteps === 0;
    const title = isSuccess
      ? chalk.greenBright.bold('✅  TASK COMPLETED SUCCESSFULLY')
      : chalk.yellowBright.bold('⚠️   TASK COMPLETED WITH ERRORS');

    const borderColor = isSuccess ? 'green' : 'yellow';
    const costStr =
      data.estimatedCost < 0.0001
        ? '< $0.0001'
        : `$${data.estimatedCost.toFixed(4)}`;

    let content = '';

    // Summary Stats
    content += `${chalk.bold.white('📊 Execution Stats')}\n`;
    content += `${chalk.gray('├─')} Status:     ${isSuccess ? chalk.green('Success') : chalk.yellow('Completed with Errors')}\n`;
    content += `${chalk.gray('├─')} Duration:   ${chalk.cyan(formatDuration(data.duration))}\n`;
    content += `${chalk.gray('├─')} Steps:      ${chalk.cyan(`${data.successfulSteps}/${data.totalSteps}`)} executed\n`;

    if (data.failedSteps > 0) {
      content += `${chalk.gray('├─')} Errors:     ${chalk.red(data.failedSteps)}\n`;
    }
    if (data.recoveredSteps) {
      content += `${chalk.gray('├─')} Recovered:  ${chalk.yellowBright(data.recoveredSteps)}\n`;
    }
    if (data.extractedItems) {
      content += `${chalk.gray('├─')} Extracted:  ${chalk.green.bold(data.extractedItems)} items\n`;
    }

    content += `${chalk.gray('└─')} Cost:       ${chalk.magenta(costStr)} (${data.tokensUsed.toLocaleString()} tokens)\n`;

    // Saved Outputs
    if (data.outputs && data.outputs.length > 0) {
      content += `\n${chalk.bold.white('💾 Saved Outputs')}\n`;
      data.outputs.forEach((ref, idx) => {
        const isLast = idx === data.outputs!.length - 1;
        const prefix = isLast ? '└─' : '├─';
        content += `${chalk.gray(prefix)} ${chalk.blue(ref)}\n`;
      });
    }

    // Recorded Flow
    if (data.flowId) {
      content += `\n${chalk.bold.white('📝 Recorded Flow')}\n`;
      content += `${chalk.gray('└─')} ID:         ${chalk.yellowBright(data.flowId)}\n`;

      content += `\n${chalk.bold.white('🚀 Next Steps')}\n`;
      content += `${chalk.gray('├─')} Replay:     ${chalk.dim('orbiter replay')} ${chalk.cyan(data.flowId)}\n`;
      content += `${chalk.gray('└─')} Optimize:   ${chalk.dim('orbiter refine')} ${chalk.cyan(data.flowId)}\n`;
    }

    // Print the boxed summary
    console.log('');
    console.log(
      boxen(content.trimEnd(), {
        title,
        titleAlignment: 'center',
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor,
        borderStyle: 'round',
      }),
    );
  },

  /**
   * Replay summary
   */
  replay(data: ReplaySummary): void {
    const isSuccess = data.success && data.stepsFailed === 0;
    const title = isSuccess
      ? chalk.greenBright.bold('✅  REPLAY COMPLETED SUCCESSFULLY')
      : chalk.yellowBright.bold('⚠️   REPLAY COMPLETED WITH ERRORS');

    const borderColor = isSuccess ? 'green' : 'yellow';

    let content = '';

    // Summary Stats
    content += `${chalk.bold.white('▶️  Replay Stats')}\n`;
    content += `${chalk.gray('├─')} Flow:       ${chalk.cyan(data.flowName)}\n`;
    content += `${chalk.gray('├─')} Status:     ${isSuccess ? chalk.green('Success') : chalk.yellow('Completed with Errors')}\n`;
    content += `${chalk.gray('├─')} Duration:   ${chalk.cyan(formatDuration(data.duration))}\n`;
    content += `${chalk.gray('├─')} Steps:      ${chalk.cyan(data.stepsExecuted)} executed\n`;

    if (data.stepsFailed > 0) {
      content += `${chalk.gray('├─')} Errors:     ${chalk.red(data.stepsFailed)}\n`;
    }
    if (data.extractedItems) {
      content += `${chalk.gray('├─')} Extracted:  ${chalk.green.bold(data.extractedItems)} items\n`;
    }

    content += `${chalk.gray('└─')} Cost:       ${chalk.green('$0.00')} (0 LLM calls)\n`;

    if (data.originalCost > 0) {
      content += `\n${chalk.bold.white('💰 Savings')}\n`;
      content += `${chalk.gray('├─')} Orig Cost:  ${chalk.yellow('$' + data.originalCost.toFixed(4))}\n`;
      content += `${chalk.gray('└─')} Saved:      ${chalk.green.bold('100% 💰')}\n`;
    }

    // Saved Outputs
    if (data.outputs && data.outputs.length > 0) {
      content += `\n${chalk.bold.white('💾 Saved Outputs')}\n`;
      data.outputs.forEach((ref, idx) => {
        const isLast = idx === data.outputs!.length - 1;
        const prefix = isLast ? '└─' : '├─';
        content += `${chalk.gray(prefix)} ${chalk.blue(ref)}\n`;
      });
    }

    // Print the boxed summary
    console.log('');
    console.log(
      boxen(content.trimEnd(), {
        title,
        titleAlignment: 'center',
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor,
        borderStyle: 'round',
      }),
    );
  },

  /**
   * Loop Engine summary
   */
  loop(data: LoopSummary): void {
    const isSuccess = data.success && data.failedItems === 0;
    const title = isSuccess
      ? chalk.greenBright.bold('✅  LOOP ENGINE COMPLETE')
      : chalk.yellowBright.bold('⚠️   LOOP ENGINE COMPLETED WITH ERRORS');

    const borderColor = isSuccess ? 'green' : 'yellow';

    let content = '';

    // Summary Stats
    content += `${chalk.bold.white('🔄 Loop Stats')}\n`;
    content += `${chalk.gray('├─')} Items:      ${chalk.green.bold(data.totalItems)} extracted\n`;
    if (data.failedItems > 0) {
      content += `${chalk.gray('├─')} Errors:     ${chalk.red(data.failedItems)} failed items\n`;
    }
    content += `${chalk.gray('├─')} Pages:      ${chalk.cyan(data.pagesProcessed)} processed\n`;
    content += `${chalk.gray('├─')} Duration:   ${chalk.cyan(formatDuration(data.duration))}\n`;
    content += `${chalk.gray('└─')} Cost:       ${chalk.green('$0.00')} (0 LLM calls)\n`;

    content += `\n${chalk.bold.white('💰 Savings')}\n`;
    content += `${chalk.gray('└─')} Estimated:  ${chalk.green.bold(data.estimatedSavings + ' 💰')}\n`;

    // Print the boxed summary
    console.log('');
    console.log(
      boxen(content.trimEnd(), {
        title,
        titleAlignment: 'center',
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderColor,
        borderStyle: 'round',
      }),
    );
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
