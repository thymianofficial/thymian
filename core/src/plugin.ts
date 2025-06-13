import type { Logger } from './logger/logger.js';
import type { ThymianEmitter } from './thymian-emitter.js';

// represents a valid JSON Schema
export type Schema = Record<string, unknown>;

export type ThymianPluginFn<Options = unknown> = (
  emitter: ThymianEmitter,
  logger: Logger,
  options: Options
) => Promise<void>;

export type ThymianPluginHooks = Record<
  string,
  {
    input: Schema;
    output: Schema;
  }
>;

export type ThymianPluginEvents = {
  emits?: Record<string, Schema>;
  listens?: string[];
};

export type ThymianPlugin<Options = unknown> = {
  plugin: ThymianPluginFn<Options>;
  options: Schema;
  name: string;
  version: string;
  hooks?: ThymianPluginHooks;
  events?: ThymianPluginEvents;
};
