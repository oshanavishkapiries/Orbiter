import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import { config } from '../../config/index.js';
import { ensureDir } from '../../utils/fs.js';

// ─────────────────────────────────────────────
// Log Level Colors & Icons
// ─────────────────────────────────────────────

const levelColors: Record<string, (text: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  debug: chalk.gray,
  trace: chalk.dim,
};

const levelIcons: Record<string, string> = {
  error: '✖',
  warn: '⚠',
  info: '●',
  debug: '○',
  trace: '·',
};

// ─────────────────────────────────────────────
// Verbosity Control
// ─────────────────────────────────────────────

let verbosityLevel: 'quiet' | 'normal' | 'verbose' | 'debug' = 'normal';

export function setVerbosity(level: typeof verbosityLevel): void {
  verbosityLevel = level;
}

export function getVerbosity(): typeof verbosityLevel {
  return verbosityLevel;
}

// ─────────────────────────────────────────────
// Console Format
// ─────────────────────────────────────────────

const consoleFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    const color = levelColors[level] || chalk.white;
    const icon = levelIcons[level] || '•';
    const time = chalk.gray(timestamp);

    let output = `${time} ${color(icon)} ${message}`;

    // Add step info if present
    if (meta.step) {
      output = `${time} ${chalk.cyan(`[${meta.step}]`)} ${color(icon)} ${message}`;
    }

    return output;
  },
);

// ─────────────────────────────────────────────
// File Format (JSON)
// ─────────────────────────────────────────────

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

// ─────────────────────────────────────────────
// Create Logger
// ─────────────────────────────────────────────

function createWinstonLogger(): winston.Logger {
  const cfg = config();
  const transports: winston.transport[] = [];

  // Console transport
  if (cfg.logging.console.enabled) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          cfg.logging.console.colorize
            ? consoleFormat
            : winston.format.simple(),
        ),
        level: verbosityLevel === 'quiet' ? 'error' : cfg.logging.level,
      }),
    );
  }

  // File transport
  if (cfg.logging.file.enabled) {
    const logDir = cfg.logging.file.path;
    ensureDir(logDir);

    // Main log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'orbiter.log'),
        format: fileFormat,
        maxsize: parseSize(cfg.logging.file.maxSize),
        maxFiles: cfg.logging.file.maxFiles,
      }),
    );

    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: parseSize(cfg.logging.file.maxSize),
        maxFiles: cfg.logging.file.maxFiles,
      }),
    );
  }

  return winston.createLogger({
    level: cfg.logging.level,
    transports,
  });
}

function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) return 10 * 1024 * 1024;

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  return value * units[unit];
}

// ─────────────────────────────────────────────
// Singleton Logger
// ─────────────────────────────────────────────

let loggerInstance: winston.Logger | null = null;

function getWinstonLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createWinstonLogger();
  }
  return loggerInstance;
}

// ─────────────────────────────────────────────
// Public Logger API
// ─────────────────────────────────────────────

export const logger = {
  error: (message: string, meta?: object) =>
    getWinstonLogger().error(message, meta),

  warn: (message: string, meta?: object) =>
    getWinstonLogger().warn(message, meta),

  info: (message: string, meta?: object) => {
    if (verbosityLevel !== 'quiet') {
      getWinstonLogger().info(message, meta);
    }
  },

  debug: (message: string, meta?: object) => {
    if (verbosityLevel === 'debug' || verbosityLevel === 'verbose') {
      getWinstonLogger().debug(message, meta);
    }
  },

  trace: (message: string, meta?: object) => {
    if (verbosityLevel === 'debug') {
      getWinstonLogger().log('trace', message, meta);
    }
  },

  // ─────────────────────────────────────────────
  // Specialized Logging Methods
  // ─────────────────────────────────────────────

  /**
   * Step progress indicator
   */
  step: (
    stepNum: number,
    total: number,
    tool: string,
    message: string,
  ): void => {
    if (verbosityLevel === 'quiet') return;

    const progress = `[${String(stepNum).padStart(2, '0')}/${String(total).padStart(2, '0')}]`;
    console.log(`\n${chalk.gray(progress)} ${chalk.cyan(tool)}`);
    console.log(`  ${chalk.gray('→')} ${message}`);
  },

  /**
   * Success checkmark
   */
  success: (message: string): void => {
    if (verbosityLevel === 'quiet') return;
    console.log(`  ${chalk.green('✓')} ${message}`);
  },

  /**
   * Failure cross
   */
  fail: (message: string): void => {
    console.log(`  ${chalk.red('✖')} ${message}`);
  },

  /**
   * Warning indicator
   */
  warning: (message: string): void => {
    console.log(`  ${chalk.yellow('⚠')} ${message}`);
  },

  /**
   * Bullet point
   */
  bullet: (message: string): void => {
    if (verbosityLevel === 'quiet') return;
    console.log(`  ${chalk.gray('→')} ${message}`);
  },

  /**
   * Blank line
   */
  blank: (): void => {
    if (verbosityLevel === 'quiet') return;
    console.log('');
  },

  /**
   * Section header
   */
  section: (title: string): void => {
    if (verbosityLevel === 'quiet') return;
    console.log('\n' + chalk.bold(title));
    console.log(chalk.gray('─'.repeat(40)));
  },

  /**
   * Phase header with emphasis
   */
  phase: (name: string): void => {
    if (verbosityLevel === 'quiet') return;
    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log(chalk.cyan.bold(`  ${name}`));
    console.log(chalk.cyan('━'.repeat(60)) + '\n');
  },
};

// ─────────────────────────────────────────────
// Spinner Helper (re-export)
// ─────────────────────────────────────────────

import ora, { Ora } from 'ora';

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
    if (verbosityLevel !== 'quiet') {
      this.spinner.start(text);
    }
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  succeed(text?: string): this {
    if (verbosityLevel !== 'quiet') {
      this.spinner.succeed(text);
    }
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
    if (verbosityLevel !== 'quiet') {
      this.spinner.info(text);
    }
    return this;
  }

  text(text: string): this {
    this.spinner.text = text;
    return this;
  }
}

export const spinner = (text: string) => new Spinner(text);
