import ora, { Ora } from 'ora';
import chalk from 'chalk';

export class Spinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora({
      text,
      color: 'cyan',
      spinner: 'dots',
    });
  }

  start(text?: string): this {
    this.spinner.start(text);
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  succeed(text?: string): this {
    this.spinner.succeed(text);
    return this;
  }

  fail(text?: string): this {
    this.spinner.fail(text);
    return this;
  }

  warn(text?: string): this {
    this.spinner.warn(text);
    return this;
  }

  info(text?: string): this {
    this.spinner.info(text);
    return this;
  }

  text(text: string): this {
    this.spinner.text = text;
    return this;
  }
}

export const spinner = (text: string) => new Spinner(text);