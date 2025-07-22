import {
  map,
  type MonoTypeOperatorFunction,
  type OperatorFunction,
} from 'rxjs';

import type {
  CustomHttpTestCaseStep,
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function step<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: MonoTypeOperatorFunction<
    PipelineItem<HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>>
  >
): OperatorFunction<
  PipelineItem<HttpTestCase<[...Steps, CurrentStep]>>,
  PipelineItem<HttpTestCase<[...Steps, CurrentStep, CustomHttpTestCaseStep]>>
> {
  return (observable) =>
    observable.pipe(
      map(({ current, ctx }) => {
        current.steps.push({
          transactions: [],
          source: {},
          type: 'custom',
        });

        const newCurr = current as unknown as HttpTestCase<
          [...Steps, CurrentStep, CustomHttpTestCaseStep]
        >;

        return { current: newCurr, ctx };
      }),
      fn
    );
}
