import type { JSONSchemaType } from 'ajv/dist/2020.js';

import packageJson from '../package.json' with { type: 'json' };
import {
  formatLoadActionSchema,
  loadFormatActionSchema,
  requestDispatchActionSchema,
  runActionSchema,
  trafficLoadActionSchema,
  validationResultSchema,
} from './actions/index.js';
import {
  RegisterPluginEventSchema,
  thymianReportSchema,
} from './events/index.js';
import type { ThymianPlugin } from './thymian-plugin.js';

export const VoidSchema = {} as JSONSchemaType<void>;

export const corePlugin: ThymianPlugin = {
  name: '@thymian/core',
  plugin(): Promise<void> {
    return Promise.resolve();
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
        response: loadFormatActionSchema,
      },
      'core.format.load': {
        event: formatLoadActionSchema,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.traffic.load': {
        event: trafficLoadActionSchema,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.run': {
        event: loadFormatActionSchema,
        response: runActionSchema,
      },
      'core.lint': {
        event: {} as JSONSchemaType<unknown>,
        response: validationResultSchema,
      },
      'core.test': {
        event: {} as JSONSchemaType<unknown>,
        response: validationResultSchema,
      },
      'core.analyze': {
        event: {} as JSONSchemaType<unknown>,
        response: validationResultSchema,
      },
      'core.request.dispatch': {
        event: requestDispatchActionSchema,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.request.sample': {
        event: {} as JSONSchemaType<unknown>,
        response: {} as JSONSchemaType<unknown>,
      },
    },
  },
  events: {
    provides: {
      'core.register':
        RegisterPluginEventSchema as unknown as JSONSchemaType<unknown>,
      'core.report': thymianReportSchema as unknown as JSONSchemaType<unknown>,
    },
  },
};
