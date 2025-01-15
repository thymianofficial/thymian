import type { Logger } from './logger.js';
import chalk from 'chalk';

export class TextLogger implements Logger {
  readonly name: string;
  readonly verbose: boolean;

  constructor(name: string, verbose = false) {
    this.name = name;
    this.verbose = verbose;
  }

  debug(msg: string): void {
    if (this.verbose) {
      console.log(`${chalk.blue(`DEBUG`)} [${this.name}]: ${msg}`);
    }
  }
  info(msg: string): void {
    console.log(`${chalk.green(`INFO`)} [${this.name}]: ${msg}`);
  }
  error(msg: string): void {
    console.error(`${chalk.red(`ERROR`)} [${this.name}]: ${msg}`);
  }
  out(output: unknown): void {
    if (typeof output !== 'undefined') {
      console.log(output);
    }
  }
  child(name: string): TextLogger {
    return new TextLogger(name, this.verbose);
  }
}
