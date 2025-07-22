import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type {
  AssertionFailure,
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
  PipelineItem,
} from '../http-test/index.js';

export function expectHeaders<Steps extends HttpTestCaseStep[]>(
  fn: (
    headers: Record<string, string | string[] | undefined>,
    transaction: HttpTestCaseStepTransaction
  ) => void
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map((envelope) => {
    for (const step of envelope.current.steps) {
      for (const transaction of step.transactions) {
        if (transaction.response?.headers) {
          try {
            fn(transaction.response.headers, transaction);
          } catch (e) {
            if (e instanceof AssertionError) {
              envelope.current.results.push({
                type: 'assertion-failure',
                message: e.message,
                timestamp: Date.now(),
                assertion: e.operator,
                expected: e.expected,
                actual: e.actual,
              });

              return envelope.ctx.fail(envelope.current, e.message);
            } else {
              throw e;
            }
          }
        }
      }
    }

    return envelope;
  });
}
