import type { JSONSchemaType } from 'ajv/dist/2020.js';

import packageJson from '../package.json' with { type: 'json' };
import {
  type RegisterPluginEvent,
  RegisterPluginEventSchema,
} from './events/register-plugin.event.js';
import type { SerializedThymianFormat } from './format/index.js';
import { type CloseHook, closeHookSchema } from './hooks/close.hook.js';
import type { EmptyHook } from './hooks/hook.js';
import {
  type LoadFormatHook,
  loadFormatHookSchema,
} from './hooks/load-format.hook.js';
import type { Logger } from './logger/logger.js';
import type { ThymianEmitter } from './thymian-emitter.js';
import type { ThymianPlugin } from './thymian-plugin.js';

export const NeverSchema = {} as JSONSchemaType<never>;
export const VoidSchema = {} as JSONSchemaType<void>;

declare module './thymian-emitter.js' {
  interface ThymianEvents {
    'core.register': RegisterPluginEvent;
  }

  interface ThymianHooks {
    'core.close': CloseHook;
    'core.ready': EmptyHook;
    'core.load-format': LoadFormatHook;
  }
}

export const corePlugin: ThymianPlugin = {
  name: '@thymian/core',
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options: unknown
  ): Promise<void> {},
  version: packageJson.version,
  hooks: {
    'core.close': {
      arg: NeverSchema,
      returns: closeHookSchema,
    },
    'core.ready': {
      arg: NeverSchema,
      returns: VoidSchema,
    },
    'core.load-format': {
      arg: {} as JSONSchemaType<never>,
      returns:
        loadFormatHookSchema as unknown as JSONSchemaType<SerializedThymianFormat>,
    },
  },
  events: {
    emits: {
      'core.register':
        RegisterPluginEventSchema as unknown as JSONSchemaType<unknown>,
    },
  },
};
