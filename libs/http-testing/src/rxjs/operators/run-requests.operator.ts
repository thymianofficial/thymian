import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTest } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';
import { runRequest } from '../run-requests.js';

export function runRequests<
  Steps extends HttpTestCaseStep[]
>(): MonoTypeOperatorFunction<HttpTest<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    const step = curr.steps.at(-1);

    if (step) {
      for await (const transaction of step.transactions) {
        transaction.response = await runRequest(transaction.request);
      }
    }

    return { curr, ctx };
  });
}
