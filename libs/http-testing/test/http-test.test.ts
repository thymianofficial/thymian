import {
  EmptySchema,
  HeaderSerializationStyle,
  NoopLogger,
  ObjectSchema,
  StringSchema,
  ThymianFormat,
  ThymianSchema,
} from '@thymian/core';
import { describe, it } from 'vitest';

import type { HttpResponse } from '../src/http-response.js';
import { httpTest } from '../src/http-test.js';
import { createHttpTestContext } from '../src/http-test-context.js';
import { forHttpTransactions } from '../src/operators/for-http-transactions.operator.js';
import { generateRequests } from '../src/operators/generate-requests.operator.js';
import { toTestCases } from '../src/operators/to-test-cases.operator.js';

describe('http test', () => {
  const format = new ThymianFormat();

  const reqId1 = format.addRequest({
    body: new ObjectSchema()
      .withProperty('name', new StringSchema())
      .withExample({ name: 'matthyk' }),
    bodyRequired: true,
    cookies: {},
    description: '',
    headers: {},
    host: 'localhost',
    mediaType: 'application/json',
    method: 'POST',
    path: '/users',
    pathParameters: {},
    port: 8080,
    protocol: 'http',
    queryParameters: {},
    type: 'http-request',
  });

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

  it('should run', async () => {
    const test = httpTest('test', (test) =>
      test.pipe(forHttpTransactions(), toTestCases(), generateRequests())
    );

    const ctx = createHttpTestContext({
      format,
      logger: new NoopLogger(),
      async runHook<Input, Output = Input>(
        name: string,
        input: Input
      ): Promise<Output> {
        return input as unknown as Output;
      },
      async runRequest(): Promise<HttpResponse> {
        return {
          body: '',
          bodyEncoding: '',
          duration: 0,
          headers: {},
          statusCode: 0,
          trailers: {},
        };
      },
      generateContent(
        schema: ThymianSchema
      ): Promise<{ content: unknown; encoding?: string }> {
        return Promise.resolve({ content: schema.examples?.[0] });
      },
    });

    await test(ctx);
  });
});
