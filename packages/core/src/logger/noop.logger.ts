/* eslint @typescript-eslint/no-empty-function: 0 */

import type { LogLevel } from './log-level.js';
import type { Logger } from './logger.js';

export class NoopLogger implements Logger {
  readonly namespace: string;
  level: LogLevel = 'silent';

  constructor(name = '') {
    this.namespace = name;
  }

  trace(): void {}
  warn(): void {}
  debug(): void {}
  info(): void {}
  error(): void {}
  out(): void {}
  child(): Logger {
    return this;
  }
}
