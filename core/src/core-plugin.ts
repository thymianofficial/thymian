import type { JSONSchemaType } from 'ajv/dist/2020.js';

import packageJson from '../package.json' with { type: 'json' };
import { closeHookSchema } from './actions/close.action.js';
import {
  loadFormatHookSchema,
} from './actions/load-format.action.js';
import {
  RegisterPluginEventSchema,
} from './events/register-plugin.event.js';
import type { SerializedThymianFormat } from './format/index.js';
import type { ThymianPlugin } from './thymian-plugin.js';

export const NeverSchema = {} as JSONSchemaType<never>;
export const VoidSchema = {} as JSONSchemaType<void>;

export const corePlugin: ThymianPlugin = {
  name: '@thymian/core',
  plugin(): Promise<void> {
    return Promise.resolve()
  },
  version: packageJson.version,
  actions: {
    provides: {
      'core.close': {
        event: NeverSchema,
        response: closeHookSchema,
      },
      'core.ready': {
        event: NeverSchema,
        response: VoidSchema,
      },
      'core.load-format': {
        event: {} as JSONSchemaType<never>,
        response:
          loadFormatHookSchema as unknown as JSONSchemaType<SerializedThymianFormat>,
      },
    }
  },
  events: {
    provides: {
      'core.register': {
        event: RegisterPluginEventSchema as unknown as JSONSchemaType<unknown>,
      },
    },
  },
};
