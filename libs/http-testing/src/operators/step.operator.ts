import {
  map,
  type MonoTypeOperatorFunction,
  type OperatorFunction,
} from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  CustomHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test-case.js';

export function step<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: MonoTypeOperatorFunction<
    HttpTestInstance<
      HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
    >
  >
): OperatorFunction<
  HttpTestInstance<HttpTestCase<[...Steps, CurrentStep]>>,
  HttpTestInstance<
    HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
  >
> {
  return (observable) =>
    observable.pipe(
      map(({ curr, ctx }) => {
        curr.steps.push({
          transactions: [],
          source: {},
          type: 'custom',
        });

        const newCurr = curr as unknown as HttpTestCase<
          [...Steps, CurrentStep, CustomHttpTestCaseStep]
        >;

        return { curr: newCurr, ctx };
      }),
      fn
    );
}
