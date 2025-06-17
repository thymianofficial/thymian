import {
  map,
  mergeMap,
  type MonoTypeOperatorFunction,
  type Observable,
  of,
  type OperatorFunction,
} from 'rxjs';

import type {
  CustomHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test-case.js';
import type { HttpTestInstance } from '../http-test.js';

export function step<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: MonoTypeOperatorFunction<
    HttpTestInstance<
      HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
    >
  > //(
  //   step: Observable<
  //     HttpTestInstance<
  //       HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
  //     >
  //   >
  // ) => Observable<
  //   HttpTestInstance<
  //     HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
  //   >
  // >
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
  // return mergeMap(({ curr, ctx }) => {
  //   const newStep: CustomHttpTestCaseStep = {
  //     transactions: [],
  //     source: {},
  //     type: 'custom',
  //   };
  //
  //   curr.steps.push(newStep);
  //
  //   const r = fn(of({ curr, ctx }));
  // });
}
