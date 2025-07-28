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
import { isFailedTestCase, isSkippedTestCase } from '../http-test/index.js';

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
        if (isSkippedTestCase(current) || isFailedTestCase(current)) {
          return {
            current: current as unknown as HttpTestCase<
              [...Steps, CurrentStep, CustomHttpTestCaseStep]
            >,
            ctx,
          };
        }

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
