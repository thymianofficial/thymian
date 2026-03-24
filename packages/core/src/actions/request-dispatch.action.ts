import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { HttpRequest, HttpResponse } from '../http.js';
import type { Action } from './action.js';

export interface HttpRequestDispatchOptions {
  timeout?: number;
}

export interface CoreRequestDispatchInput {
  request: HttpRequest;
  options?: HttpRequestDispatchOptions;
}

export type RequestDispatchAction = Action<
  CoreRequestDispatchInput,
  HttpResponse
>;

export const requestDispatchActionSchema = {
  type: 'object',
  nullable: false,
  required: ['request'],
  additionalProperties: false,
  properties: {
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
      properties: {
        timeout: { type: 'integer', nullable: true },
      },
    },
    request: {
      type: 'object',
      nullable: false,
      required: ['origin', 'method', 'path'],
      additionalProperties: false,
      properties: {
        origin: { type: 'string', nullable: false },
        path: { type: 'string', nullable: false },
        method: { type: 'string', nullable: false },
        body: { type: 'string', nullable: true },
        bodyEncoding: { type: 'string', nullable: true },
        headers: {
          type: 'object',
          nullable: true,
          required: [],
          additionalProperties: {
            oneOf: [
              {
                type: 'array',
                items: { type: 'string' },
              },
              { type: 'string' },
            ],
          },
        },
        timeout: { type: 'number', nullable: true },
      },
    },
  },
} as JSONSchemaType<CoreRequestDispatchInput>;
