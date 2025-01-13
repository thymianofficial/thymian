import type { Logger } from './logger/logger.js';
import type { ThymianEmitter } from './thymian-emitter.js';

// represents a valid JSON Schema
export type Schema = Record<string, unknown>;

export type Event = {
  description?: string;
  schema: Schema;
};

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
  events?: {
    emits?: Record<string, Event>;
    listens?: string[];
  };
};
