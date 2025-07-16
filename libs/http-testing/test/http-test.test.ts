import { NoopLogger, type ThymianHttpRequest } from '@thymian/core';
import { buildExampleApp, exampleAppFormat } from '@thymian/test-utils';
import type { FastifyInstance } from 'fastify';
import { groupBy, mergeMap } from 'rxjs';
import { beforeEach, describe, it } from 'vitest';

import { httpTest } from '../src/http-test.js';
import {
  createHttpTestContext,
  type HttpTestContext,
} from '../src/http-test-context.js';
import {
  overrideHeaders,
  overrideRequestWithPrevious,
  replayStep,
  replayStepButExpectResponse,
} from '../src/index.js';
import { defineStep } from '../src/operators/define-test.operator.js';
import { expectStatusCode } from '../src/operators/expect-status-code.operator.js';
import { forHttpTransactions } from '../src/operators/for-http-transactions.operator.js';
import { generateRequests } from '../src/operators/generate-requests.operator.js';
import { runRequests } from '../src/operators/run-requests.operator.js';
import { skipTestCase } from '../src/operators/skip.operator.js';
import { step } from '../src/operators/step.operator.js';
import { toTestCases } from '../src/operators/to-test-cases.operator.js';
import { validateResponses } from '../src/operators/validate-responses.operator.js';
import {
  createRequestRunner,
  exampleContentGenerator,
  identityHookRunner,
} from '../src/test-utils/index.js';

describe('httpTest - todo app', () => {
  let todoApp: FastifyInstance;
  let context: HttpTestContext;

  beforeEach(() => {
    todoApp = buildExampleApp();
    context = createHttpTestContext({
      format: exampleAppFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createRequestRunner(todoApp),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });
  });

  it('basic', async () => {
    const test = httpTest('all requests', {
      validate: true,
    });

    await test(context);
  });

  it('should ignore skipped test cases', async () => {
    const test = httpTest('GET requests', (test) =>
      test.pipe(
        forHttpTransactions({ method: 'GET' }),
        toTestCases(),
        skipTestCase(),
        generateRequests(),
        runRequests(),
        validateResponses()
      )
    );

    await test(context);
  });

  it('location header', async () => {
    const test = httpTest('location header', (test) =>
      test.pipe(
        defineStep({
          authorize: true,
          validate: true,
          reqFilter: { method: 'POST' },
          resFilter: { statusCode: 201 },
        }),
        step((step) =>
          step.pipe(
            mergeMap(async ({ curr, ctx }) => {
              const [previous, current] = curr.steps;

              const previousTransaction = previous.transactions[0];

              if (!previousTransaction || !previousTransaction.response) {
                return ctx.skip(curr, 'No previous step available.');
              }

              const { location } = previousTransaction.response.headers;

              if (!location || Array.isArray(location)) {
                return ctx.fail(curr, 'Missing location header field.');
              }

              const matchResult = ctx.format.matchHtpRequestByUrl(location);

              if (!matchResult) {
                return ctx.skip(curr, 'Did not find matching request.');
              }

              const responses = ctx.format.getHttpResponsesOf(
                matchResult.reqId
              );
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const thymianReq = ctx.format.getNode<ThymianHttpRequest>(
                matchResult.reqId
              )!;

              if (responses.length === 0) {
                return ctx.fail(
                  curr,
                  `Thymian HTTP request with id ${matchResult.reqId} does not have corresponding HTTP response.`
                );
              }
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const [thymianResId, thymianRes] = responses[0]!;
              const transactionId = ctx.format.graph.findEdge(
                matchResult.reqId,
                thymianResId,
                (id, edge) => edge.type === 'http-transaction'
              );

              if (!transactionId) {
                return ctx.fail(
                  curr,
                  `Missing HTTP Transaction edge for request ${matchResult.reqId} and response ${thymianResId}.`
                );
              }

              const request = await ctx.generateRequest(ctx.format, {
                thymianReqId: matchResult.reqId,
                thymianReq,
                transactionId,
                thymianRes,
                thymianResId,
              });

              request.pathParameters = {
                ...request.pathParameters,
                ...matchResult.parameters,
              };

              current.transactions.push({
                requestTemplate: request,
              });

              current.source = {
                thymianReqId: matchResult.reqId,
              };

              return { curr, ctx };
            }),
            runRequests(),
            expectStatusCode('2XX')
          )
        )
      )
    );

    await test(context);
  });

  it('groupBy', async () => {
    const test = httpTest('groupby', (test) =>
      test.pipe(
        forHttpTransactions({ method: 'GET' }, { statusCode: 200 }),
        groupBy(({ curr }) => curr.thymianReq.host),
        toTestCases(),
        generateRequests(),
        runRequests()
      )
    );

    await test(context);
  });

  it('my rfc 9110 test', async () => {
    const test = httpTest('test', (t) =>
      t.pipe(
        forHttpTransactions(
          (req, reqId, responses) =>
            Object.keys(req.headers).some(
              (h) => h.toLowerCase() === 'if-range'
            ) &&
            responses.some(([, res]) => res.statusCode === 206) &&
            responses.some(([, res]) => res.statusCode === 200),
          (res) => res.statusCode === 206
        ),
        toTestCases(),
        generateRequests(),
        runRequests(),
        replayStep((step) =>
          step.pipe(
            overrideRequestWithPrevious((requestTemplate, previous) => {
              const transaction = previous.transactions[0];

              if (transaction && transaction.response) {
                const etagHeader = transaction.response.headers['etag'];

                if (typeof etagHeader === 'string') {
                  return {
                    ...requestTemplate,
                    headers: {
                      ...requestTemplate.headers,
                      'if-range': etagHeader,
                    },
                  };
                }
              }

              return requestTemplate;
            }),
            runRequests()
          )
        ),
        replayStepButExpectResponse({ statusCode: 200 }, (step) =>
          step.pipe(
            overrideHeaders((headers) => {
              if ('if-range' in headers) {
                headers['if-range'] = '"abc"';
              }

              return headers;
            }),
            runRequests()
          )
        )
      )
    );

    await test(context);
  });
});
