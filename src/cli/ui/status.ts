import chalk from 'chalk';

export const status = {
  /**
   * Phase header
   */
  phase(name: string): void {
    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log(chalk.cyan.bold(`  ${name}`));
    console.log(chalk.cyan('━'.repeat(60)) + '\n');
  },

  /**
   * Section divider
   */
  divider(): void {
    console.log(chalk.gray('─'.repeat(60)));
  },

  /**
   * Section header
   */
  section(title: string): void {
    console.log('\n' + chalk.bold(title));
    console.log(chalk.gray('─'.repeat(40)));
  },

  /**
   * Key-value display
   */
  keyValue(key: string, value: string | number, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.gray(key + ':')} ${value}`);
  },

  /**
   * Bullet point
   */
  bullet(text: string, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.gray('→')} ${text}`);
  },

  /**
   * Check mark
   */
  check(text: string, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.green('✓')} ${text}`);
  },

  /**
   * Cross mark
   */
  cross(text: string, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.red('✖')} ${text}`);
  },

  /**
   * Warning mark
   */
  warn(text: string, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.yellow('⚠')} ${text}`);
  },

  /**
   * Info mark
   */
  info(text: string, indent: number = 2): void {
    const spaces = ' '.repeat(indent);
    console.log(`${spaces}${chalk.blue('●')} ${text}`);
  },

  /**
   * Step indicator with progress
   */
  step(current: number, total: number, tool: string, detail?: string): void {
    const progress = `[${String(current).padStart(2, '0')}/${String(total).padStart(2, '0')}]`;
    const toolName = chalk.cyan(tool);
    const detailText = detail ? chalk.gray(` - ${detail}`) : '';

    console.log(`\n${chalk.gray(progress)} ${toolName}${detailText}`);
  },

  /**
   * Inline status update
   */
  inline(text: string): void {
    process.stdout.write(`\r${text}`);
  },

  /**
   * Clear line
   */
  clearLine(): void {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  },
};
