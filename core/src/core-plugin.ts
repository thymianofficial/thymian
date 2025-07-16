import type { JSONSchemaType } from 'ajv/dist/2020.js';

import packageJson from '../package.json' with { type: 'json' };
import { loadFormatActionSchema, runActionSchema } from './actions/index.js';
import { RegisterPluginEventSchema,thymianReportSchema } from './events/index.js';
import type { ThymianPlugin } from './thymian-plugin.js';

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
        event: VoidSchema,
        response: VoidSchema,
      },
      'core.ready': {
        event: VoidSchema,
        response: VoidSchema,
      },
      'core.load-format': {
        event: {} as JSONSchemaType<never>,
        response:
          loadFormatActionSchema,
      },
      'core.run': {
        event: loadFormatActionSchema,
        response: runActionSchema
      }
    }
  },
  events: {
    provides: {
      'core.register': RegisterPluginEventSchema as unknown as JSONSchemaType<unknown>,
      'core.report': thymianReportSchema as unknown as JSONSchemaType<unknown>,
    },
  },
};
