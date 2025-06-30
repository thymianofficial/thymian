import type { Dispatcher } from 'undici';
import type { JSONSchemaType } from '@thymian/core/ajv';

export type HttpRequest = {
  url: string;
  method: string;
  body?: string;
  bodyEncoding?: string;
  headers?: Record<string, string | string[]>;
  timeout?: number;
};

export const httpRequestSchema: JSONSchemaType<HttpRequest> = {
  type: 'object',
  properties: {
    url: { type: 'string', nullable: false },
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
  required: ['url', 'method'],
  additionalProperties: false,
};

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
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
    body: { type: 'string', nullable: false },
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
  required: ['statusCode', 'headers', 'body', 'trailers', 'duration'],
  additionalProperties: false,
} as const;

export type HttpMethod = Dispatcher.RequestOptions['method'];
