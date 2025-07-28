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

export type HttpTestCaseTransactionValidationFn = (
  transaction: HttpTestCaseStepTransaction
) => void;

export function expectForTransactions<Steps extends HttpTestCaseStep[]>(
  fn: HttpTestCaseTransactionValidationFn
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const step = current.steps.at(-1);

    if (!step) {
      ctx.logger.warn(
        `Calling "expectForTransaction" for test case "${current.name}" that includes no test case steps.`
      );

      return { current, ctx };
    }

    for (const transaction of step.transactions) {
      try {
        fn(transaction);
      } catch (e) {
        if (e instanceof AssertionError) {
          current.results.push({
            type: 'assertion-failure',
            message: e.message,
            timestamp: Date.now(),
            assertion: e.operator,
            expected: e.expected,
            actual: e.actual,
            transaction: transaction.source,
          });

          return ctx.fail(current, e.message);
        } else {
          throw e;
        }
      }
    }

    return { current, ctx };
  });
}
