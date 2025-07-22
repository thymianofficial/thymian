import { NoopLogger } from '@thymian/core';
import {
  buildToDoApp,
  createFastifyRequestRunner,
  todoAppFormat,
} from '@thymian/test-utils';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, it } from 'vitest';

import {
  createHttpTestContext,
  filterHttpTransactions,
  generateRequests,
  httpTest,
  type HttpTestContext,
  mapToTestCase,
  runRequests,
  validateResponses,
} from '../src/index.js';
import { exampleContentGenerator, identityHookRunner } from './utils.js';

describe('httpTest - todo app', () => {
  let exampleApp: FastifyInstance;
  let context: HttpTestContext;

  beforeEach(async () => {
    exampleApp = await buildToDoApp();
    context = createHttpTestContext({
      locals: {},
      format: todoAppFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createFastifyRequestRunner(exampleApp),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });
  });

  it('All GET transactions with 200 response', async () => {
    const test = httpTest('GET requests', (transactions) =>
      transactions.pipe(
        filterHttpTransactions(
          { method: 'GET', path: '/projects/{id}' },
          { statusCode: 200 }
        ),
        mapToTestCase(),
        generateRequests(),
        runRequests(),
        validateResponses()
      )
    );

    const r = await test(context);

    console.log(JSON.stringify(r));
    console.log(r);
  });

  // it('location header', async () => {
  //   const test = httpTest('location header', (test) =>
  //     test.pipe(
  //       defineStep({
  //         authorize: true,
  //         validate: true,
  //         reqFilter: { method: 'POST' },
  //         resFilter: { statusCode: 201 },
  //       }),
  //       step((step) =>
  //         step.pipe(
  //           mergeMap(async ({ curr, ctx }) => {
  //             const [previous, current] = curr.steps;
  //
  //             const previousTransaction = previous.transactions[0];
  //
  //             if (!previousTransaction || !previousTransaction.response) {
  //               return ctx.skip(curr, 'No previous step available.');
  //             }
  //
  //             const { location } = previousTransaction.response.headers;
  //
  //             if (!location || Array.isArray(location)) {
  //               return ctx.fail(curr, 'Missing location header field.');
  //             }
  //
  //             const matchResult = ctx.format.matchHtpRequestByUrl(location);
  //
  //             if (!matchResult) {
  //               return ctx.skip(curr, 'Did not find matching request.');
  //             }
  //
  //             const responses = ctx.format.getHttpResponsesOf(
  //               matchResult.reqId
  //             );
  //             // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //             const thymianReq = ctx.format.getNode<ThymianHttpRequest>(
  //               matchResult.reqId
  //             )!;
  //
  //             if (responses.length === 0) {
  //               return ctx.fail(
  //                 curr,
  //                 `Thymian HTTP request with id ${matchResult.reqId} does not have corresponding HTTP response.`
  //               );
  //             }
  //             // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //             const [thymianResId, thymianRes] = responses[0]!;
  //             const transactionId = ctx.format.graph.findEdge(
  //               matchResult.reqId,
  //               thymianResId,
  //               (id, edge) => edge.type === 'http-transaction'
  //             );
  //
  //             if (!transactionId) {
  //               return ctx.fail(
  //                 curr,
  //                 `Missing HTTP Transaction edge for request ${matchResult.reqId} and response ${thymianResId}.`
  //               );
  //             }
  //
  //             const request = await ctx.generateRequest(ctx.format, {
  //               thymianReqId: matchResult.reqId,
  //               thymianReq,
  //               transactionId,
  //               thymianRes,
  //               thymianResId,
  //             });
  //
  //             request.pathParameters = {
  //               ...request.pathParameters,
  //               ...matchResult.parameters,
  //             };
  //
  //             current.transactions.push({
  //               requestTemplate: request,
  //             });
  //
  //             current.source = {
  //               thymianReqId: matchResult.reqId,
  //             };
  //
  //             return { curr, ctx };
  //           }),
  //           runRequests(),
  //           expectStatusCode('2XX')
  //         )
  //       )
  //     )
  //   );
  //
  //   await test(context);
  // });
  //
  // it('groupBy', async () => {
  //   const test = httpTest('groupby', (test) =>
  //     test.pipe(
  //       filterHttpTransactions({ method: 'GET' }, { statusCode: 200 }),
  //       groupBy(({ curr }) => curr.thymianReq.host),
  //       mapToTestCase(),
  //       generateRequests(),
  //       runRequests()
  //     )
  //   );
  //
  //   await test(context);
  // });
  //
  // it('my rfc 9110 test', async () => {
  //   const test = httpTest('test', (t) =>
  //     t.pipe(
  //       filterHttpTransactions(
  //         (req, reqId, responses) =>
  //           Object.keys(req.headers).some(
  //             (h) => h.toLowerCase() === 'if-range'
  //           ) &&
  //           responses.some(([, res]) => res.statusCode === 206) &&
  //           responses.some(([, res]) => res.statusCode === 200),
  //         (res) => res.statusCode === 206
  //       ),
  //       mapToTestCase(),
  //       generateRequests(),
  //       runRequests(),
  //       replayStep((step) =>
  //         step.pipe(
  //           overrideRequestWithPrevious((requestTemplate, previous) => {
  //             const transaction = previous.transactions[0];
  //
  //             if (transaction && transaction.response) {
  //               const etagHeader = transaction.response.headers['etag'];
  //
  //               if (typeof etagHeader === 'string') {
  //                 return {
  //                   ...requestTemplate,
  //                   headers: {
  //                     ...requestTemplate.headers,
  //                     'if-range': etagHeader,
  //                   },
  //                 };
  //               }
  //             }
  //
  //             return requestTemplate;
  //           }),
  //           runRequests()
  //         )
  //       ),
  //       replayStepButExpectResponse({ statusCode: 200 }, (step) =>
  //         step.pipe(
  //           overrideHeaders((headers) => {
  //             if ('if-range' in headers) {
  //               headers['if-range'] = '"abc"';
  //             }
  //
  //             return headers;
  //           }),
  //           runRequests()
  //         )
  //       )
  //     )
  //   );
  //
  //   await test(context);
  // });
});
