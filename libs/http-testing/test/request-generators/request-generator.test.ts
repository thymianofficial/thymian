import { describe, it } from 'vitest';
import { RequestGenerator } from '../../src/rxjs/request-generator/request-generator.js';
import {
  ArraySchema,
  EmptySchema,
  HeaderSerializationStyle,
  ObjectSchema,
  QuerySerializationStyle,
  StringSchema,
  ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';
import { RangeRequestGenerator } from '../../src/rxjs/request-generator/range-request-generator.js';

const format = new ThymianFormat();

const req1: ThymianHttpRequest = {
  body: new ObjectSchema()
    .withProperty('name', new StringSchema())
    .withExample({ name: 'matthyk' }),
  bodyRequired: true,
  cookies: {},
  description: '',
  headers: {
    'x-header': {
      style: new HeaderSerializationStyle(),
      schema: new StringSchema().withExample('my x-header value'),
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
      style: new QuerySerializationStyle(),
      schema: new ArraySchema().withExample(['1', '2']),
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
      schema: new StringSchema(),
      style: new HeaderSerializationStyle(),
    },
  },
  mediaType: '',
  schema: new EmptySchema(),
  statusCode: 201,
  type: 'http-response',
});

format.addHttpTransaction(reqId1, res1);

describe('RequestGenerator', () => {
  it('test', async () => {
    const generator = new RangeRequestGenerator(
      new ThymianFormat(),
      {
        thymianReqId: reqId1,
        thymianResId: res1,
        thymianReq: req1,
      },
      async (schema) => ({ content: schema.examples?.[0] })
    );

    console.log(await generator.generate());
  });
});
