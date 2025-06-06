import {
  EmptySchema,
  HeaderSerializationStyle,
  ObjectSchema,
  PathSerializationStyle,
  StringSchema,
  ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';
import { filter, groupBy, map, tap } from 'rxjs';
import { describe, it } from 'vitest';

import { test } from '../src/rxjs/http-test.js';
import { filterGroup } from '../src/rxjs/operators/filter-group.operator.js';
import { generateRequestsForTestCases } from '../src/rxjs/operators/generate-requests.js';
import { forHttpTransactions } from '../src/rxjs/operators/for-http-transactions.operator';
import { runRequests } from '../src/rxjs/operators/run-requests.operator.js';
import { step } from '../src/rxjs/operators/step.operator.js';
import { toTestCases } from '../src/rxjs/operators/to-test-cases.operator';

describe('pipeline', () => {
  // it('runs', async () => {
  //   const pipeline2 = new SingleHttpTestPipeline(
  //     [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  //     {
  //       fail(msg?: string): void {},
  //       pass(msg?: string): void {},
  //       skip(msg?: string): void {},
  //     }
  //   ).pipeInCool(
  //     (input, ctx) => [input.filter((x) => x % 2 === 0) as number[], ctx],
  //     (input, ctx) => [
  //       input.map((x) => ''.padStart(x, 'X')),
  //       { prefix: 'test' },
  //     ],
  //     (input, ctx) => {
  //       console.log(ctx.prefix);
  //       input.forEach(console.log);
  //
  //       return [input, ctx];
  //     }
  //   );
  //
  //   console.log(await processPipeline(pipeline2));
  // });
  //
  // function map2<Input, Output, Ctx extends Record<PropertyKey, unknown>>(
  //   fn: (input: Input) => Output
  // ): Operator<Input, Output, Ctx, Ctx> {
  //   return (input, ctx) => [fn(input), ctx];
  // }
  //
  // function tap2<Input, Ctx extends Record<PropertyKey, unknown>>(
  //   fn: () => unknown
  // ): Operator<Input, Input, Ctx, Ctx> {
  //   return async (input, ctx) => {
  //     await fn();
  //     return [input, ctx];
  //   };
  // }
  //
  // it('test pipeline', async () => {
  //   const pipeline = new HttpTestPipeline();
  //
  //   pipeline.pipe(
  //     map2((format) => format.getHttpTransactions()),
  //     (input, ctx) => [input, { ...ctx, val: 1 }],
  //     (input, ctx) => {
  //       console.log(ctx.val);
  //       return [input, ctx];
  //     }
  //   );
  //
  //   console.log(await pipeline.process(new ThymianFormat(), { testVal: 3 }));
  // });
  //
  // function context<
  //   Input,
  //   InContext extends Record<PropertyKey, unknown>,
  //   OutContext extends Record<PropertyKey, unknown>
  // >(
  //   fn: (cx: InContext) => OutContext | Promise<OutContext>
  // ): Operator<Input, Input, InContext, OutContext> {
  //   return async (input, ctx) => {
  //     return [input, await fn(ctx)];
  //   };
  // }
  //
  // function generateRequests<
  //   Ctx extends Record<PropertyKey, unknown>
  // >(): Operator<
  //   ThymianHttpTransaction[],
  //   (ThymianHttpTransaction & { actualReq: HttpRequest })[],
  //   Ctx
  // > {
  //   return async (input, ctx) => {
  //     return [
  //       input.map<ThymianHttpTransaction & { actualReq: HttpRequest }>(
  //         (transaction) => ({
  //           ...transaction,
  //           actualReq: {
  //             origin: '',
  //             path: '',
  //             pathParameters: {},
  //             method: '',
  //             query: {},
  //             headers: {},
  //           },
  //         })
  //       ),
  //       ctx,
  //     ];
  //   };
  // }
  //
  // function httpTransactions2<Ctx extends Record<PropertyKey, unknown>>(
  //   reqFilter: StringAndNumberProperties<ThymianHttpRequest> = {},
  //   resFilter: StringAndNumberProperties<ThymianHttpResponse> = {}
  // ): Operator<ThymianFormat, ThymianHttpTransaction[], Ctx> {
  //   return (format, ctx) => {
  //     const transactions = format
  //       .getHttpTransactions()
  //       .map<ThymianHttpTransaction>(([reqId, resId]) => ({
  //         reqId,
  //         resId,
  //         req: format.getNode<ThymianHttpRequest>(reqId),
  //         res: format.getNode<ThymianHttpResponse>(resId),
  //       }))
  //       .filter(
  //         (transaction) =>
  //           matchObjects(transaction.req, reqFilter) &&
  //           matchObjects(transaction.res, resFilter)
  //       );
  //
  //     return [transactions, ctx];
  //   };
  // }
  //
  // function runRequests(): Operator<
  //   (ThymianHttpTransaction & { actualReq: HttpRequest })[],
  //   (ThymianHttpTransaction & {
  //     actualReq: HttpRequest;
  //     actualResponse: HttpResponse;
  //   })[]
  // > {
  //   return async (input, ctx) => {
  //     const results = await Promise.all(
  //       input.map(async (transaction) => {
  //         const actualResponse: HttpResponse = {};
  //         return { ...transaction, actualResponse };
  //       })
  //     );
  //     return [results, ctx];
  //   };
  // }
  //
  // function assert(
  //   fn: (
  //     transaction: ThymianHttpTransaction & {
  //       actualReq: HttpRequest;
  //       actualResponse: HttpResponse;
  //     }
  //   ) => string[]
  // ): Operator<
  //   (ThymianHttpTransaction & {
  //     actualReq: HttpRequest;
  //     actualResponse: HttpResponse;
  //   })[],
  //   (ThymianHttpTransaction & {
  //     actualReq: HttpRequest;
  //     actualResponse: HttpResponse;
  //     messages: string[];
  //   })[]
  // > {
  //   return (input, ctx) => {
  //     const results = input.map((transaction) => ({
  //       ...transaction,
  //       messages: fn(transaction),
  //     }));
  //
  //     return [results, ctx];
  //   };
  // }
  //
  // function groupBy2<T, K extends string | number>(
  //   keyFn: (item: T) => K
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-expect-error
  // ): Operator<T[], Record<K, T>> {}
  //
  // it('define location header test', async () => {
  //   const pipeline = new HttpTestPipeline();
  //
  //   console.log(
  //     await pipeline
  //       .pipe(
  //         httpTransactions2({ method: 'POST' }, { statusCode: 201 }),
  //         generateRequests(),
  //         sendRequest(),
  //         tap2(() => {
  //           throw new Error('');
  //         }),
  //         assert()
  //       )
  //       .process(new ThymianFormat(), {})
  //   );
  // });
  //
  // it('sequence', async () => {
  //   const sequence = new SequenceTestBuilder();
  //
  //   sequence.step((pipeline) => pipeline.pipe());
  // });

  it('rxjs', async () => {
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
      statusCode: 201,
      type: 'http-response',
    });

    format.addHttpTransaction(reqId2, res2);

    // of<ThymianFormat>(format)
    //   .pipe(
    //     mapToHttpTransactions({ method: 'POST' }, { statusCode: 201 }),
    //     mapToTestCase(),
    //     sendRequest(),
    //     map((testCase) => {
    //       const { actualRes } = testCase.data;
    //
    //       if (typeof actualRes.headers['location'] !== 'string') {
    //         return {
    //           ...testCase,
    //           status: 'failed',
    //         };
    //       } else {
    //         const matched = format.matchHtpRequestByUrl(
    //           actualRes.headers.location
    //         );
    //
    //         return {};
    //       }
    //     }),
    //     // mergeMap((transaction) => {
    //     //   if (typeof transaction.actualRes.headers['location'] !== 'string') {
    //     //     return of({
    //     //       assertionFailure: 'Location header is not defined',
    //     //     });
    //     //   } else {
    //     //     return of(transaction);
    //     //   }
    //     // })
    //     //mergeMap()
    //     tap((val) => {})
    //   )a
    //   .subscribe({
    //     next: (val) => console.log(''),
    //     complete: () => console.log('completed'),
    //     error: (err) => console.error('ERROR: ' + err),
    //   });

    const testFn = test('location header', (thymianFormat, {
      format,
      generateRequests,
      runRequests,
    }) =>
      thymianFormat.pipe(
        forHttpTransactions({ method: 'POST' }, { statusCode: 201 }),
        groupBy((trans) => trans.thymianReq.method),
        toTestCases(),
        generateRequests(4),
        runRequests(),
        step((step) =>
          step.pipe(
            map((testCase) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              testCase.steps.at(-1)!.requests.push({
                headers: {},
                method: 'QUERY',
                origin: 'localhost:9090',
                path: '',
                pathParameters: {},
                query: {},
              });

              return testCase;
            })
          )
        )
      ));

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const result = await testFn({ format });

    console.log(JSON.stringify(result));

    const testFn2 = test('lost update problem', (observable, { format }) =>
      observable.pipe(
        forHttpTransactions(),
        groupBy((transaction) => {
          const { protocol, host, port, path } = transaction.thymianReq;

          return `${protocol}://${host}${port}${path}`;
        }),
        filterGroup(
          (transactions) =>
            transactions.some(
              (transaction) => transaction.thymianReq.method === 'PUT'
            ) &&
            transactions.some(
              (transaction) => transaction.thymianReq.method === 'GET'
            )
        ),
        toTestCases(),
        generateRequestsForTestCases(),
        runRequests(),
        step((step) =>
          step.pipe(
            map((testCase) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              testCase.steps.at(-1)!.requests.push({
                headers: {},
                method: 'QUERY',
                origin: 'localhost:9090',
                path: '',
                pathParameters: {},
                query: {},
              });

              return testCase;
            })
          )
        )
      ));

    const testFn3 = test('lost update problem', (observable, {
      format,
      runHook,
      runRequests,
    }) =>
      observable.pipe(
        forHttpTransactions(),
        filter(
          (transaction) =>
            transaction.thymianReq.method === 'GET' &&
            typeof format.findNode<ThymianHttpRequest>('http-request', {
              method: 'PUT',
              path: transaction.thymianReq.path,
            }) !== 'undefined'
        ),
        toTestCases(),
        runHook('test'),
        generateRequestsForTestCases(),
        step((step) => step.pipe())
      ));
  });
});
