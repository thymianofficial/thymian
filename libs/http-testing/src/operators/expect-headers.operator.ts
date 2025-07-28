import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseStep,
  type HttpTestCaseStepTransaction,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';

export function expectHeaders<Steps extends HttpTestCaseStep[]>(
  fn: (
    headers: Record<string, string | string[] | undefined>,
    transaction: HttpTestCaseStepTransaction
  ) => void
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    for (const step of current.steps) {
      for (const transaction of step.transactions) {
        if (transaction.response?.headers) {
          try {
            fn(transaction.response.headers, transaction);
          } catch (e) {
            if (e instanceof AssertionError) {
              current.results.push({
                type: 'assertion-failure',
                message: e.message,
                timestamp: Date.now(),
                assertion: e.operator,
                expected: e.expected,
                actual: e.actual,
              });

              return ctx.fail(current, e.message);
            } else {
              throw e;
            }
          }
        }
      }
    }

    return { current, ctx };
  });
}
