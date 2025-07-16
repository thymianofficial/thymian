import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type { HttpTestCase, HttpTestCaseStep } from '../http-test-case.js';

export function replayStep<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: (
    step: Observable<
      HttpTestInstance<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
    >
  ) => Observable<
    HttpTestInstance<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
  >
): OperatorFunction<
  HttpTestInstance<HttpTestCase<[...Steps, CurrentStep]>>,
  HttpTestInstance<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
> {
  return mergeMap(({ ctx, curr }) => {
    const prevStep = curr.steps.at(-1);

    if (typeof prevStep === 'undefined') {
      throw new Error('Previous step must be defined.');
    }

    const newStep = {
      type: prevStep.type,
      source: prevStep.source,
      transactions: prevStep.transactions.map((transaction) => ({
        requestTemplate: transaction.requestTemplate,
        source: transaction.source,
      })),
    } as CurrentStep;

    curr.steps.push(newStep);

    return fn(
      of({
        ctx,
        curr: curr as unknown as HttpTestCase<
          [...Steps, CurrentStep, CurrentStep]
        >,
      })
    );
  });
}
