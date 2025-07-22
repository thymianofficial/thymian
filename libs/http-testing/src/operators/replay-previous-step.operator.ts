import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import type {
  HttpTestCase,
  HttpTestCaseStep,
} from '../http-test/http-test-case.js';
import type { PipelineItem } from '../http-test/http-test-pipeline.js';

export function replayStep<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  fn: (
    step: Observable<
      PipelineItem<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
    >
  ) => Observable<
    PipelineItem<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
  >
): OperatorFunction<
  PipelineItem<HttpTestCase<[...Steps, CurrentStep]>>,
  PipelineItem<HttpTestCase<[...Steps, CurrentStep, CurrentStep]>>
> {
  return mergeMap(({ ctx, current }) => {
    const prevStep = current.steps.at(-1);

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

    current.steps.push(newStep);

    return fn(
      of({
        ctx,
        current: current as HttpTestCase<[...Steps, CurrentStep, CurrentStep]>,
      })
    );
  });
}
