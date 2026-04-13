import chalk from 'chalk';
import boxen from 'boxen';

const VERSION = '1.0.0';

export const banners = {
  /**
   * Main application banner
   */
  main(): string {
    return boxen(
      chalk.cyan.bold('🚀 ORBITER') +
        chalk.gray(` v${VERSION}\n`) +
        chalk.dim('AI-powered browser automation'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
      },
    );
  },

  /**
   * Run command banner
   */
  run(task: string): string {
    return (
      '\n' +
      boxen(
        chalk.cyan.bold('🚀 ORBITER') +
          chalk.gray(' - Browser Automation\n\n') +
          chalk.white.bold('Task: ') +
          chalk.yellow(task),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
        },
      )
    );
  },

  /**
   * Replay command banner
   */
  replay(flowName: string): string {
    return (
      '\n' +
      boxen(
        chalk.cyan.bold('🔄 ORBITER') +
          chalk.gray(' - Flow Replay\n\n') +
          chalk.white.bold('Flow: ') +
          chalk.yellow(flowName),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
        },
      )
    );
  },

  /**
   * Refine command banner
   */
  refine(flowName: string): string {
    return (
      '\n' +
      boxen(
        chalk.cyan.bold('🧹 ORBITER') +
          chalk.gray(' - Flow Refiner\n\n') +
          chalk.white.bold('Flow: ') +
          chalk.yellow(flowName),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
        },
      )
    );
  },

  /**
   * Loop Engine banner
   */
  loopEngine(taskName: string, itemCount?: number): string {
    const countText = itemCount
      ? chalk.gray(`\nItems found: ${itemCount}`)
      : '';

    return (
      '\n' +
      boxen(
        chalk.magenta.bold('🔄 LOOP ENGINE') +
          chalk.gray(' - Pattern Extraction\n\n') +
          chalk.white.bold('Task: ') +
          chalk.yellow(taskName) +
          countText,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'magenta',
        },
      )
    );
  },

  /**
   * Error banner
   */
  error(message: string): string {
    return boxen(chalk.red.bold('❌ ERROR\n\n') + chalk.white(message), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'red',
    });
  },

  /**
   * Success banner
   */
  success(message: string): string {
    return boxen(chalk.green.bold('✅ SUCCESS\n\n') + chalk.white(message), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
    });
  },

  /**
   * Warning banner
   */
  warning(message: string): string {
    return boxen(chalk.yellow.bold('⚠️  WARNING\n\n') + chalk.white(message), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    });
  },
};
