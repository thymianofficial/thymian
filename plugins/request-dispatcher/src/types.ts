import type { Dispatcher } from 'undici';
import type { JSONSchemaType } from '@thymian/core/ajv';
import type { HttpRequest, HttpResponse } from '@thymian/core';

export const httpRequestSchema: JSONSchemaType<HttpRequest> = {
  type: 'object',
  properties: {
    origin: { type: 'string', nullable: false },
    path: { type: 'string', nullable: false },
    method: { type: 'string', nullable: false },
    body: { type: 'string', nullable: true },
    bodyEncoding: { type: 'string', nullable: true },
    headers: {
      type: 'object',
      required: [],
      nullable: true,
      additionalProperties: {
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          {
            type: 'string',
          },
        ],
      },
    },
    timeout: { type: 'number', nullable: true },
  },
  required: ['origin', 'method', 'path'],
  additionalProperties: false,
};

export const httpResponseSchema: JSONSchemaType<HttpResponse> = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer', nullable: false },
    headers: {
      type: 'object',
      required: [],
      additionalProperties: {
        oneOf: [
          {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          {
            type: 'string',
          },
        ],
      },
    },
    body: { type: 'string', nullable: true },
    bodyEncoding: { type: 'string', nullable: true },
    trailers: {
      type: 'object',
      required: [],
      additionalProperties: {
        type: 'string',
        nullable: false,
      },
    },
    duration: { type: 'number', nullable: false },
  },
  required: ['statusCode', 'headers', 'trailers', 'duration'],
  additionalProperties: false,
} as const;

export type HttpMethod = Dispatcher.RequestOptions['method'];
