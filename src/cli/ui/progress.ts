import cliProgress from 'cli-progress';
import chalk from 'chalk';

export function createProgressBar(total: number, label: string = 'Progress') {
  const bar = new cliProgress.SingleBar({
    format: `  ${label} ${chalk.cyan('{bar}')} {percentage}% | {value}/{total} | {status}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
  });

  bar.start(total, 0, { status: 'Starting...' });

  return {
    update: (value: number, status?: string) => {
      bar.update(value, { status: status || 'Processing...' });
    },
    increment: (status?: string) => {
      bar.increment({ status: status || 'Processing...' });
    },
    stop: () => {
      bar.stop();
    },
  };
}