import { format } from 'node:util';

import chalk from 'chalk';

import type { Logger } from './logger.js';

export class TextLogger implements Logger {
  readonly namespace: string;
  readonly verbose: boolean;

  constructor(name: string, verbose = false) {
    this.namespace = name;
    this.verbose = verbose;
  }

  trace(formatter: unknown, ...args: unknown[]): void {
    if (this.verbose) {
      console.debug(
        `${chalk.grey(`TRACE`)} [${this.namespace}]: ${format(
          formatter,
          ...args
        )}`
      );
    }
  }
  warn(formatter: unknown, ...args: unknown[]): void {
    console.warn(
      `${chalk.yellow(`WARN`)} [${this.namespace}]: ${format(
        formatter,
        ...args
      )}`
    );
  }

  debug(formatter: unknown, ...args: unknown[]): void {
    if (this.verbose) {
      console.debug(
        `${chalk.blue(`DEBUG`)} [${this.namespace}]: ${format(
          formatter,
          ...args
        )}`
      );
    }
  }
  info(formatter: unknown, ...args: unknown[]): void {
    console.log(
      `${chalk.green(`INFO`)} [${this.namespace}]: ${format(
        formatter,
        ...args
      )}`
    );
  }
  error(formatter: unknown, ...args: unknown[]): void {
    console.error(
      `${chalk.red(`ERROR`)} [${this.namespace}]: ${format(formatter, ...args)}`
    );
  }
  out(output: unknown): void {
    if (typeof output !== 'undefined') {
      console.log(output);
    }
  }
  child(name: string, verbose = false): Logger {
    return new TextLogger(name, verbose ?? this.verbose);
  }
}
