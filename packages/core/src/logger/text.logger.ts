import { format } from 'node:util';

import chalk from 'chalk';

import type { LogLevel } from './log-level.js';
import { shouldLog } from './log-level.js';
import type { Logger } from './logger.js';

export class TextLogger implements Logger {
  readonly namespace: string;
  readonly level: LogLevel;

  constructor(name: string, level: LogLevel = 'warn') {
    this.namespace = name;
    this.level = level;
  }

  trace(formatter: unknown, ...args: unknown[]): void {
    if (shouldLog('trace', this.level)) {
      console.log(
        `${chalk.grey(`TRACE`)} [${this.now()}] [${this.namespace}]: ${format(
          formatter,
          ...args,
        )}`,
      );
    }
  }
  warn(formatter: unknown, ...args: unknown[]): void {
    if (shouldLog('warn', this.level)) {
      console.log(
        `${chalk.yellow(`WARN`)} [${this.now()}] [${this.namespace}]: ${format(
          formatter,
          ...args,
        )}`,
      );
    }
  }

  debug(formatter: unknown, ...args: unknown[]): void {
    if (shouldLog('debug', this.level)) {
      console.log(
        `${chalk.blue(`DEBUG`)} [${this.now()}] [${this.namespace}]: ${format(
          formatter,
          ...args,
        )}`,
      );
    }
  }
  info(formatter: unknown, ...args: unknown[]): void {
    if (shouldLog('info', this.level)) {
      console.log(
        `${chalk.green(`INFO`)} [${this.now()}] [${this.namespace}]: ${format(
          formatter,
          ...args,
        )}`,
      );
    }
  }
  error(formatter: unknown, ...args: unknown[]): void {
    if (shouldLog('error', this.level)) {
      console.log(
        `${chalk.red(`ERROR`)} [${this.now()}] [${this.namespace}]: ${format(
          formatter,
          ...args,
        )}`,
      );
    }
  }
  out(output: unknown): void {
    if (this.level === 'silent') {
      return;
    }

    if (typeof output !== 'undefined') {
      console.log(output);
    }
  }
  child(name: string): Logger {
    return new TextLogger(name, this.level);
  }

  private now(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}
