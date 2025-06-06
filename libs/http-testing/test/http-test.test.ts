import { describe, it } from 'vitest';
import { test } from '../src/rxjs/http-test.js';
import { forHttpTransactions } from '../src/rxjs/operators/for-http-transactions.operator.js';
import { toTestCases } from '../src/rxjs/operators/to-test-cases.operator.js';
import { createHttpTestContext } from '../src/rxjs/http-test-context.js';
import {
  EmptySchema,
  HeaderSerializationStyle,
  NoopLogger,
  ObjectSchema,
  PathSerializationStyle,
  StringSchema,
  ThymianFormat,
  ThymianSchema,
} from '@thymian/core';
import {
  generateRequests,
  HttpRequestTemplate,
  ThymianHttpTestTransaction,
} from '../src';

const format = new ThymianFormat();

const reqId1 = format.addRequest({
  body: new ObjectSchema().withProperty('name', new StringSchema()),
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

// const reqId2 = format.addRequest({
//   body: new EmptySchema(),
//   bodyRequired: false,
//   cookies: {},
//   description: '',
//   headers: {},
//   host: 'localhost',
//   mediaType: '',
//   method: 'POST',
//   path: '/users/{userId}',
//   pathParameters: {
//     userId: {
//       required: true,
//       schema: new StringSchema(),
//       style: new PathSerializationStyle(),
//     },
//   },
//   port: 8080,
//   protocol: 'http',
//   queryParameters: {},
//   type: 'http-request',
// });
//
// const res2 = format.addResponse({
//   headers: {
//     location: {
//       required: true,
//       schema: new StringSchema(),
//       style: new HeaderSerializationStyle(),
//     },
//   },
//   mediaType: 'application/json',
//   schema: new ObjectSchema().withProperty('name', new StringSchema()),
//   statusCode: 200,
//   type: 'http-response',
// });
//
// format.addHttpTransaction(reqId2, res2);

describe('Http test', () => {
  it('should run', async () => {
    const httpTest = test('test', (test) =>
      test.pipe(forHttpTransactions(), toTestCases(), generateRequests()));

    const ctx = createHttpTestContext({
      format,
      generateContent(
        schema: ThymianSchema,
        contentType: string | undefined,
        context:
          | {
              reqId: string;
              resId: string;
            }
          | undefined
      ): Promise<{ content: unknown; encoding?: string }> {
        return Promise.resolve({ content: { name: 'matthyk' } });
      },
      generateRequestFor(reqId: string): Promise<HttpRequestTemplate> {
        return Promise.resolve(undefined);
      },
      logger: new NoopLogger(),
      generateRequest(
        format: ThymianFormat,
        transaction: ThymianHttpTestTransaction
      ): Promise<HttpRequestTemplate> {
        return Promise.resolve({
          body: {
            name: 'matthyk',
          },
        });
      },
    });

    console.log(JSON.stringify(await httpTest(ctx)));
  });
});
