import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
} from '../http-test-case.js';
import { serializeRequest } from '../serialize-request.js';

export function runRequests<
  Steps extends HttpTestCaseStep[]
>(): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }

    const step = curr.steps.at(-1);

    if (step) {
      for await (const transaction of step.transactions) {
        transaction.response = await ctx.runRequest(
          serializeRequest(transaction)
        );
      }
    }

    return { curr, ctx };
  });
}
