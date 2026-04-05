import cliProgress from 'cli-progress';

export function createProgressBar(total: number, format?: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: format || ' {bar} {percentage}% | {value}/{total} steps',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
}
