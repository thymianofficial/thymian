import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { ThymianBaseError } from '../thymian.error.js';

export type ErrorEvent = ThymianBaseError;

export const errorEventSchema: JSONSchemaType<ThymianBaseError> = {
  // TODO
  anyOf: [],
  oneOf: [],
  type: 'object',
  required: ['name', 'message', 'exitCode', 'options'],
  properties: {
    exitCode: { type: 'number' },
    message: { type: 'string', nullable: false },
    causingError: { type: 'object', required: [], nullable: true },
    stack: { type: 'string', nullable: true },
    name: { type: 'string', nullable: false },
    cause: { type: 'object', nullable: true },
    options: {
      nullable: false,
      type: 'object',
      properties: {
        exitCode: {
          type: 'number',
          nullable: true,
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        ref: {
          type: 'string',
          nullable: true,
        },
        code: {
          type: 'string',
          nullable: true,
        },
        name: {
          type: 'string',
          nullable: true,
        },
        severity: {
          type: 'string',
          enum: ['info', 'warn', 'error'],
          nullable: false,
        },
      },
      required: ['severity'],
    },
  },
};
