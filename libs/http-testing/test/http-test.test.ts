import { NoopLogger, type ThymianHttpRequest } from '@thymian/core';
import type { FastifyInstance } from 'fastify';
import { mergeMap } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { httpTest } from '../src/http-test.js';
import {
  createHttpTestContext,
  type HttpTestContext,
} from '../src/http-test-context.js';
import { authorizeRequests } from '../src/operators/authorize-requests.operator.js';
import { defineStep } from '../src/operators/define-test.operator.js';
import { forHttpTransactions } from '../src/operators/for-http-transactions.operator.js';
import { generateRequests } from '../src/operators/generate-requests.operator.js';
import { runRequests } from '../src/operators/run-requests.operator.js';
import { skip } from '../src/operators/skip.operator.js';
import { step } from '../src/operators/step.operator.js';
import { toTestCases } from '../src/operators/to-test-cases.operator.js';
import { validateResponses } from '../src/operators/validate-responses.operator.js';
import { buildTodosApp } from './fixture/todo-app/app.js';
import { todoFormat } from './fixture/todo-app/todo.format.js';
import {
  createRequestRunner,
  exampleContentGenerator,
  identityHookRunner,
} from './utils.js';
import { expectStatusCode } from '../src/operators/expect-status-code.operator.js';

describe('httpTest - todo app', () => {
  let todoApp: FastifyInstance;
  let context: HttpTestContext;

  beforeEach(() => {
    todoApp = buildTodosApp();
    context = createHttpTestContext({
      format: todoFormat,
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

    const result = await test(context);

    expect(result.cases).toHaveLength(2);
  });

  it('should ignore skipped test cases', async () => {
    const test = httpTest('GET requests', (test) =>
      test.pipe(
        forHttpTransactions({ method: 'GET' }),
        toTestCases(),
        skip(),
        generateRequests(),
        authorizeRequests(),
        runRequests(),
        validateResponses()
      )
    );

    const result = await test(context);

    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]).toMatchObject({
      status: 'skipped',
      results: [],
    });
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

              const request = await ctx.generateRequestFor(matchResult.reqId);

              request.pathParameters = {
                ...request.pathParameters,
                ...matchResult.parameters,
              };

              current.transactions.push({
                request,
              });

              current.source = {
                thymianReqId: matchResult.reqId,
              };

              return { curr, ctx };
            }),
            authorizeRequests(),
            runRequests(),
            expectStatusCode('2XX')
          )
        )
      )
    );

    const result = await test(context);

    console.log(JSON.stringify(result));
  });
});
