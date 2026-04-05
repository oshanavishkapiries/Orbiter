import winston from 'winston';
import chalk from 'chalk';
import { config } from '../../config/index.js';

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

// Custom format for console
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const color = levelColors[level] || chalk.white;
  const icon = levelIcons[level] || '•';
  
  let output = `${chalk.gray(timestamp)} ${color(icon)} ${message}`;
  
  // Add metadata if present
  if (Object.keys(meta).length > 0 && meta.step) {
    output = `${chalk.gray(timestamp)} ${chalk.cyan(`[${meta.step}]`)} ${color(icon)} ${message}`;
  }
  
  return output;
});

// Custom format for file
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

export function createLogger() {
  const cfg = config();
  
  const transports: winston.transport[] = [];
  
  // Console transport
  if (cfg.logging.console.enabled) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          cfg.logging.console.colorize ? consoleFormat : winston.format.simple()
        ),
      })
    );
  }
  
  // File transport
  if (cfg.logging.file.enabled) {
    transports.push(
      new winston.transports.File({
        filename: `${cfg.logging.file.path}/orbiter.log`,
        format: fileFormat,
        maxsize: parseSize(cfg.logging.file.maxSize),
        maxFiles: cfg.logging.file.maxFiles,
      })
    );
    
    // Separate error log
    transports.push(
      new winston.transports.File({
        filename: `${cfg.logging.file.path}/error.log`,
        level: 'error',
        format: fileFormat,
        maxsize: parseSize(cfg.logging.file.maxSize),
        maxFiles: cfg.logging.file.maxFiles,
      })
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
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';
  
  return value * units[unit];
}

// Singleton logger instance
let loggerInstance: winston.Logger | null = null;

export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

// Convenience exports
export const logger = {
  error: (message: string, meta?: object) => getLogger().error(message, meta),
  warn: (message: string, meta?: object) => getLogger().warn(message, meta),
  info: (message: string, meta?: object) => getLogger().info(message, meta),
  debug: (message: string, meta?: object) => getLogger().debug(message, meta),
  trace: (message: string, meta?: object) => getLogger().log('trace', message, meta),
  
  // Specialized logging
  step: (stepNum: number, total: number, action: string, message: string) => {
    getLogger().info(message, { step: `${stepNum}/${total}`, action });
  },
  
  success: (message: string) => {
    console.log(`  ${chalk.green('✓')} ${message}`);
  },
  
  fail: (message: string) => {
    console.log(`  ${chalk.red('✖')} ${message}`);
  },
  
  bullet: (message: string) => {
    console.log(`  ${chalk.gray('→')} ${message}`);
  },
};