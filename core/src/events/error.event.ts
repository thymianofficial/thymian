import type { ThymianError } from '../thymian.error.js';
import type { JSONSchemaType } from 'ajv/dist/2020.js';

export type ErrorEvent = ThymianError;

export const errorEventSchema: JSONSchemaType<ThymianError> = {
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
