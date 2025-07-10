import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function overrideRequestWithPrevious<
  Steps extends HttpTestCaseStep[],
  Previous extends HttpTestCaseStep,
  Current extends HttpTestCaseStep
>(
  fn: (
    requestTemplate: HttpRequestTemplate,
    previous: Previous
  ) => HttpRequestTemplate
): MonoTypeOperatorFunction<
  HttpTestInstance<HttpTestCase<[...Steps, Previous, Current]>>
> {
  return map(({ curr, ctx }) => {
    const previous = curr.steps.at(-2) as Previous | undefined;

    if (typeof previous === 'undefined') {
      throw new Error('Previous http test case step must be defined.');
    }

    const current = curr.steps.at(-1) as Current | undefined;

    if (typeof current === 'undefined') {
      throw new Error('Current http test case step must be defined.');
    }

    current.transactions = current.transactions.map((transaction) => ({
      ...transaction,
      requestTemplate: fn(transaction.requestTemplate, previous),
    }));

    return { curr, ctx };
  });
}
