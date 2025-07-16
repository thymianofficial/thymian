import { AssertionError } from 'node:assert';

import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  HttpTestCaseStepTransaction,
} from '../http-test-case.js';

export function expectHeaders<Steps extends HttpTestCaseStep[]>(
  fn: (
    headers: Record<string, string | string[] | undefined>,
    transaction: HttpTestCaseStepTransaction
  ) => void
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return map((testInstance) => {
    for (const step of testInstance.curr.steps) {
      for (const transaction of step.transactions) {
        if (transaction.response?.headers) {
          try {
            fn(transaction.response.headers, transaction);
          } catch (e) {
            if (e instanceof AssertionError) {
              testInstance.curr.results.push({
                type: 'assertion-failure',
                message: e.message,
              });
            } else {
              throw e;
            }
          }
        }
      }
    }

    return testInstance;
  });
}
