import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function overrideHeaders<Steps extends HttpTestCaseStep[]>(
  fn: (
    headers: Record<string, unknown>,
    testCase: HttpTestCase<Steps>
  ) => Record<string, unknown>
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return map(({ curr, ctx }) => {
    const current = curr.steps.at(-1);

    if (typeof current === 'undefined') {
      throw new Error('Current http test case step must be defined.');
    }

    for (const transaction of current.transactions) {
      transaction.requestTemplate.headers = fn(
        transaction.requestTemplate.headers,
        curr
      );
    }

    return { curr, ctx };
  });
}
