import type { LogLevel } from './log-level.js';

export interface Logger {
  namespace: string;
  level: LogLevel;
  debug(formatter: unknown, ...args: unknown[]): void;
  info(formatter: unknown, ...args: unknown[]): void;
  error(formatter: unknown, ...args: unknown[]): void;
  trace(formatter: unknown, ...args: unknown[]): void;
  warn(formatter: unknown, ...args: unknown[]): void;
  out(output: unknown): void;
  child(name: string): Logger;
}
