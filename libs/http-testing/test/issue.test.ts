import { NoopLogger, type ThymianHttpRequest } from '@thymian/core';
import type { FastifyInstance } from 'fastify';
import { filter, mergeMap } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { httpTest } from '../src/http-test.js';
import {
  createHttpTestContext,
  type HttpTestContext,
} from '../src/http-test-context.js';
import { authorizeRequests } from '../src/operators/authorize-requests.operator.js';
import { defineStep } from '../src/operators/define-test.operator.js';
import { expectStatusCode } from '../src/operators/expect-status-code.operator.js';
import { forHttpTransactions } from '../src/operators/for-http-transactions.operator.js';
import { generateRequests } from '../src/operators/generate-requests.operator.js';
import { runRequests } from '../src/operators/run-requests.operator.js';
import { skipTestCase } from '../src/operators/skip.operator.js';
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

describe('issue', () => {
  it('should work', async () => {
    const ctx = createHttpTestContext({
      format: todoFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createRequestRunner(buildTodosApp()),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });

    const test = httpTest('why', (test) =>
      test.pipe(
        forHttpTransactions(),
        filter(
          ({ ctx, curr }) => {
            return (
              curr.thymianReq.method.toUpperCase() === 'GET' &&
              curr.thymianRes.statusCode === 200
            );
          }
          // filterFn(
          //   thymianToCommonHttpRequest(curr.thymianReqId, curr.thymianReq),
          //   thymianToCommonHttpResponse(curr.thymianResId, curr.thymianRes),
          //   ctx.format
          //     .getNeighboursOfType(curr.thymianReqId, 'http-response')
          //     .map(([resId, res]) => thymianToCommonHttpResponse(resId, res))
        ),
        toTestCases(),
        generateRequests(),
        authorizeRequests(),
        runRequests()
      )
    );

    const testResult = await test(ctx);

    console.log(JSON.stringify(testResult));
  });
});
