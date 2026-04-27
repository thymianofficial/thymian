import type { JSONSchemaType } from 'ajv/dist/2020.js';

import packageJson from '../package.json' with { type: 'json' };
import {
  coreValidateSpecsActionSchema,
  formatLoadActionSchema,
  requestDispatchActionSchema,
  specValidationResultsSchema,
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
      'core.format.load': {
        event: formatLoadActionSchema,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.traffic.load': {
        event: trafficLoadActionSchema,
        response: {} as JSONSchemaType<unknown>,
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
      'core.validate-specs': {
        event: coreValidateSpecsActionSchema,
        response: specValidationResultsSchema,
      },
      'core.request.dispatch': {
        event: requestDispatchActionSchema,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.request.sample': {
        event: {} as JSONSchemaType<unknown>,
        response: {} as JSONSchemaType<unknown>,
      },
      'core.report.flush': {
        event: VoidSchema,
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
