import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { ThymianBaseError } from '../thymian.error.js';

export type ErrorEvent = ThymianBaseError;

export const errorEventSchema: JSONSchemaType<ThymianBaseError> = {
  anyOf: [],
  oneOf: [],
  type: 'object',
  required: ['name', 'message', 'exitCode'],
  properties: {
    exitCode: { type: 'number' },
    message: { type: 'string', nullable: false },
    causingError: { type: 'object', required: [], nullable: true },
    stack: { type: 'string', nullable: true },
    name: { type: 'string', nullable: false },
    cause: { type: 'string' },
  },
};
