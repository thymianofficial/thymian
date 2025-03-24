/* eslint @typescript-eslint/no-empty-function: 0 */

import type { Logger } from './logger.js';

export class NoopLogger implements Logger {
  readonly name: string;

  constructor(name = '') {
    this.name = name;
  }

  debug(): void {}
  info(): void {}
  error(): void {}
  out(): void {}
  child(): NoopLogger {
    return this;
  }
}
