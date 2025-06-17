import type { Dispatcher } from 'undici';

export type HttpRequest = {
  url: string;
  method: string;
  body?: string;
  bodyEncoding?: string;
  headers?: Record<string, string | string[]>;
  timeout?: number;
};

export const httpRequestSchema = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    method: { type: 'string' },
    body: { type: 'string' },
    bodyEncoding: { type: 'string' },
    headers: {
      type: 'object',
      additionalProperties: {
        type: ['array', 'string'],
        items: { type: 'string' },
      },
    },
    timeout: { type: 'number' },
  },
  required: ['url', 'method'],
  additionalProperties: false,
} as const;

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  bodyEncoding?: string;
  trailers: Record<string, string>;
  duration: number;
};

export const httpResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    headers: {
      type: 'object',
      additionalProperties: {
        type: ['array', 'string'],
        items: { type: 'string' },
      },
    },
    body: { type: 'string' },
    bodyEncoding: { type: 'string' },
    trailers: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    duration: { type: 'number' },
  },
  required: ['statusCode', 'headers', 'body', 'trailers', 'duration'],
  additionalProperties: false,
} as const;

export type HttpMethod = Dispatcher.RequestOptions['method'];
