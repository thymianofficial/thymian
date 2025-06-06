import { describe, it } from 'vitest';

import { sequence } from '../src/dsl/sequence-http-test-builder.js';
import { SequenceTestRunner } from '../src/test-runner/sequence-test-runner.js';
import {
  EmptySchema,
  HeaderSerializationStyle,
  NoopLogger,
  ObjectSchema,
  PathSerializationStyle,
  StringSchema,
  ThymianFormat,
} from '@thymian/core';
import type { HttpRequestExecutor } from '../src/test-runner/request-executor.js';
import type { HookRunner } from '../src/test-runner/hook-runner.js';
import type { HttpRequestTemplate } from '../src/rxjs/http-request-template';
import type { HttpResponse } from '../src/rxjs/http-response';

function isTypeOfString(element: unknown): element is string {
  return typeof element === 'string';
}

class MockExecutor implements HttpRequestExecutor {
  request(request: HttpRequestTemplate): Promise<HttpResponse> {
    throw new Error('Method not implemented.');
  }
  requestWithLock(request: HttpRequestTemplate): Promise<HttpResponse> {
    throw new Error('Method not implemented.');
  }
  parallel(request: HttpRequestTemplate[]): Promise<HttpResponse[]> {
    throw new Error('Method not implemented.');
  }
}

class MockHookRunner implements HookRunner {}

describe('http test builder', () => {
  it('should work', async () => {
    const seq1 = sequence('location header', (sequence) =>
      // sequence.pipe(
      //   step('create resource', (o: Observable<Transactions[]>) =>
      //           t
      //             .filterHttpTransactions(
      //               ({ req, res }) => req.method === 'POST' && res.statusCode === 201
      //             )
      //             .done()
      //         )
      //   ...
      //     step.pipe(
      //       ...
      //     )
      //
      //
      // )

      sequence
        //.create(({ req, res }) => req.method === 'POST' && res.statusCode === 201)
        //.filter('create resource', { method: 'POST', statusCode: 201 })
        .step('create resource', (t) =>
          t
            .filterHttpTransactions(
              ({ req, res }) => req.method === 'POST' && res.statusCode === 201
            )
            .done()
        )
        .step('get resource', (t) =>
          t
            .context((ctx) => {
              const locationUrl =
                ctx.steps['create resource'].res.headers['location'];

              if (!isTypeOfString(locationUrl)) {
                ctx.fail('Response does not contain location url.');
              }

              const matched = ctx.format.matchHtpRequestByUrl(
                locationUrl as string
              );

              if (typeof matched !== 'undefined') {
                return {
                  reqId: matched.reqId,
                  parameters: matched.parameters,
                };
              }

              ctx.fail();
            })
            .filterHttpTransactions(({ reqId, ctx }) => reqId === ctx.reqId)
            .overridePathParameters((original, ctx) => {
              const parameters = { ...original };

              for (const [name, value] of Object.entries(ctx.parameters)) {
                if (typeof value === 'undefined') {
                  /* empty */
                } else if (Array.isArray(value)) {
                  parameters[name] = value.join('');
                } else {
                  parameters[name] = value;
                }
              }

              return parameters;
            })
            .done()
        )
        .done()
    );

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

    const reqId2 = format.addRequest({
      body: new EmptySchema(),
      bodyRequired: false,
      cookies: {},
      description: '',
      headers: {},
      host: 'localhost',
      mediaType: '',
      method: 'POST',
      path: '/users/{userId}',
      pathParameters: {
        userId: {
          required: true,
          schema: new StringSchema(),
          style: new PathSerializationStyle(),
        },
      },
      port: 8080,
      protocol: 'http',
      queryParameters: {},
      type: 'http-request',
    });

    const res2 = format.addResponse({
      headers: {
        location: {
          required: true,
          schema: new StringSchema(),
          style: new HeaderSerializationStyle(),
        },
      },
      mediaType: 'application/json',
      schema: new ObjectSchema().withProperty('name', new StringSchema()),
      statusCode: 200,
      type: 'http-response',
    });

    format.addHttpTransaction(reqId2, res2);

    const runner = new SequenceTestRunner(
      seq1,
      new NoopLogger(),
      new MockExecutor(),
      new MockHookRunner(),
      format
    );

    console.log(await runner.run());

    // const seq2 = test('should return 415 error', (t) =>
    //   t
    //     .filterHttpTransactions(
    //       ({ req }) =>
    //         req.method === 'POST' || (req.method === 'PUT' && req.bodyRequired)
    //     )
    //     .groupHttpRequestsBy(['method', 'path', 'host', 'protocol', 'port'])
    //     .mapGroupTo((keys, requests, ctx) => {
    //       const mediaTypes = ['text/plain']; // ...
    //
    //       const notSupportedMediaType = mediaTypes.find((mt) =>
    //         requests.some(({ req }) => req.mediaType === mt)
    //       );
    //
    //       if (typeof notSupportedMediaType === 'undefined') {
    //         ctx.skip();
    //       }
    //
    //       return {
    //         headers: {
    //           'Content-Type': notSupportedMediaType,
    //         },
    //         origin: new URL(
    //           `${keys.protocol}://${keys.host}:${keys.port}/${keys.path}`
    //         ).toString(),
    //         query: {},
    //         pathParameters: {},
    //       };
    //     })
    //     .done());
  });
});
