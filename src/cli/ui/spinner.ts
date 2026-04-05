import ora, { Ora } from 'ora';

let spinner: Ora | null = null;

export function startSpinner(text: string): Ora {
  spinner = ora(text).start();
  return spinner;
}

export function stopSpinner(success?: string): void {
  if (spinner) {
    if (success) {
      spinner.succeed(success);
    } else {
      spinner.stop();
    }
    spinner = null;
  }
}

export function failSpinner(text: string): void {
  if (spinner) {
    spinner.fail(text);
    spinner = null;
  }
}
