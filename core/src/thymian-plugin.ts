import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { ThymianActionName, ThymianActions } from './actions/index.js';
import { ThymianEmitter } from './emitter/index.js';
import type { ThymianEventName, ThymianEvents } from './events/index.js';
import type { Logger } from './logger/logger.js';
import { isRecord } from './utils.js';

export type ThymianPluginFn<Options = unknown> = (
  emitter: ThymianEmitter,
  logger: Logger,
  options: Options
) => Promise<void>;

export type ThymianPluginEvents = {
  provides?: {
    [Name in ThymianEventName]?: JSONSchemaType<
      Event extends keyof ThymianEvents ? ThymianEvents[Name] : unknown
    >;
  };
  emits?: ThymianEventName[];
  listensOn?: ThymianEventName[];
};

export type ThymianPluginActions = {
  provides?: {
    [Name in ThymianActionName]?: {
      event: JSONSchemaType<
        Name extends keyof ThymianActions
          ? ThymianActions[Name]['event']
          : unknown
      >;
      response: JSONSchemaType<
        Name extends keyof ThymianActions
          ? ThymianActions[Name]['response']
          : unknown
      >;
    };
  };
  emits?: ThymianActionName[];
  requires?: ThymianActionName[];
  listensOn?: ThymianActionName[];
};

export type ThymianPlugin<Options = unknown> = {
  plugin: ThymianPluginFn<Options>;
  options?: JSONSchemaType<Options>;
  name: string;
  version: string;
  events?: ThymianPluginEvents;
  actions?: ThymianPluginActions;
};

export function isPlugin(plugin: unknown): plugin is ThymianPlugin {
  if (!isRecord(plugin)) return false;

  const requiredKeys = ['plugin', 'name', 'version'];
  for (const key of requiredKeys) {
    if (!Object.hasOwn(plugin, key)) return false;
  }

  return true;
}
