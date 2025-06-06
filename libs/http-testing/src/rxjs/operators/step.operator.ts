import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import type {
  CustomHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test-case.js';

export function step<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: (
    step: Observable<
      HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
    >
  ) => Observable<HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>>
): OperatorFunction<
  HttpTestCase<[...Steps, CurrentStep]>,
  HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>
> {
  return mergeMap((testCase) => {
    const newStep: CustomHttpTestCaseStep = {
      transactions: [],
      source: {},
      type: 'custom',
    };

    testCase.steps.push(newStep);

    return fn(
      of(
        testCase as unknown as HttpTestCase<
          [...Steps, CurrentStep, CustomHttpTestCaseStep]
        >
      )
    );
  });
}
