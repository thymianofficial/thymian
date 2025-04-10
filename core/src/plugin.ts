import type { Logger } from './logger/logger.js';
import type { ThymianEmitter } from './thymian-emitter.js';

// represents a valid JSON Schema
export type Schema = Record<string, unknown>;

export type ThymianPluginFn<Options = unknown> = (
  emitter: ThymianEmitter,
  logger: Logger,
  options: Options
) => Promise<void>;

export type ThymianPlugin<Options = unknown> = {
  plugin: ThymianPluginFn<Options>;
  options: Schema;
  name: string;
  version: string;
  hooks?: Record<
    string,
    {
      input: Schema;
      output: Schema;
    }
  >;
  events?: {
    emits?: Record<string, Schema>;
    listens?: string[];
  };
};
