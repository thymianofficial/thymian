import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { Logger } from './logger/logger.js';
import type {
  ThymianEmitter,
  ThymianEvent,
  ThymianEvents,
  ThymianHook,
  ThymianHooks,
} from './thymian-emitter.js';
import { isRecord } from './utils.js';

export type ThymianPluginFn<Options = unknown> = (
  emitter: ThymianEmitter,
  logger: Logger,
  options: Options
) => Promise<void>;

export type ThymianPluginHooks = {
  [K in keyof ThymianHooks]?: {
    arg: JSONSchemaType<ThymianHooks[K]['arg']>;
    returns: JSONSchemaType<ThymianHooks[K]['returnType']>;
  };
};

export type ThymianPluginEvents = {
  emits?: {
    [K in ThymianEvent]?: JSONSchemaType<
      K extends keyof ThymianEvents ? ThymianEvents[K] : unknown
    >;
  };
  listens?: ThymianEvent[];
};

export type ThymianPlugin<Options = unknown> = {
  plugin: ThymianPluginFn<Options>;
  options?: JSONSchemaType<Options>;
  name: string;
  version: string;
  hooks?: ThymianPluginHooks;
  events?: ThymianPluginEvents;
};

export function isPlugin(plugin: unknown): plugin is ThymianPlugin {
  if (!isRecord(plugin)) return false;

  const requiredKeys = ['plugin', 'name', 'version'];
  for (const key of requiredKeys) {
    if (!Object.hasOwn(plugin, key)) return false;
  }

  return true;
}
