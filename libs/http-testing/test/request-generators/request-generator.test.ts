import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  DEFAULT_QUERY_SERIALIZATION_STYLE,
  ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';
import { describe, it } from 'vitest';

import { RangeRequestGenerator } from '../../src/request-generator/range-request-generator.js';

const format = new ThymianFormat();

const req1: ThymianHttpRequest = {
  body: {
    type: 'object',
    properties: { name: { type: 'string', examples: ['matthyk'] } },
  },
  bodyRequired: true,
  cookies: {},
  description: '',
  headers: {
    'x-header': {
      style: DEFAULT_HEADER_SERIALIZATION_STYLE,
      schema: { type: 'string', examples: ['my x-header value'] },
      required: true,
    },
  },
  host: 'localhost',
  mediaType: 'application/json',
  method: 'POST',
  path: '/users',
  pathParameters: {},
  port: 8080,
  protocol: 'http',
  queryParameters: {
    search: {
      style: DEFAULT_QUERY_SERIALIZATION_STYLE,
      schema: { type: 'array', examples: [['1', '2']] },
      required: true,
    },
  },
  type: 'http-request',
};

const reqId1 = format.addRequest(req1);

const res1 = format.addResponse({
  headers: {
    location: {
      required: true,
      schema: { type: 'string' },
      style: DEFAULT_HEADER_SERIALIZATION_STYLE,
    },
  },
  mediaType: '',
  schema: {},
  statusCode: 201,
  type: 'http-response',
});

format.addHttpTransaction(reqId1, res1);

describe('RequestGenerator', () => {
  it('test', async () => {});
});
