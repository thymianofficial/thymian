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
  transaction: HttpTestCaseStepTransaction,
) => void;

export function expectForTransactions<Steps extends HttpTestCaseStep[]>(
  fn: HttpTestCaseTransactionValidationFn,
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const step = current.steps.at(-1);

    if (!step) {
      ctx.logger.warn(
        `Calling "expectForTransaction" for test case "${current.name}" that includes no test case steps.`,
      );

      return { current, ctx };
    }

    // `expectForTransaction` always validates the last (most recent) step.
    const stepIdx = current.steps.length - 1;

    for (const [transactionIdx, transaction] of step.transactions.entries()) {
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
            // Tag the failure with its position so the report can trace it back
            // to the exact step and HTTP transaction (see BaseFinding.transactionIndex).
            location: { stepIdx, transactionIdx },
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
