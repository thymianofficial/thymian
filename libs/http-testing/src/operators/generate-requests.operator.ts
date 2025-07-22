import type { PartialExceptFor } from '@thymian/core';
import { mergeMap, type OperatorFunction } from 'rxjs';

import {
  type GenerateRequestsOptions,
  type HttpTestCase,
  type HttpTestCaseStep,
  type HttpTestCaseStepTransaction,
  type HttpTestContextLocals,
  type PipelineItem,
  type SingleHttpTestCaseStep,
} from '../http-test/index.js';
import {
  isCustomHttpTestCaseStep,
  isFailedTestCase,
  isGroupedHttpTestCaseStep,
  isSingleHttpTestCaseStep,
  isSkippedTestCase,
} from '../http-test/index.js';

type InferStep<Step extends HttpTestCaseStep> =
  Step extends SingleHttpTestCaseStep<infer Transactions>
    ? SingleHttpTestCaseStep<
        [
          ...Transactions,
          PartialExceptFor<
            HttpTestCaseStepTransaction,
            'requestTemplate' | 'source'
          >
        ]
      >
    : Step;

export function generateRequests<
  PreviousSteps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep,
  Locals extends HttpTestContextLocals
>(
  options?: GenerateRequestsOptions
): OperatorFunction<
  PipelineItem<HttpTestCase<[...PreviousSteps, CurrentStep]>, Locals>,
  PipelineItem<HttpTestCase<[...PreviousSteps, InferStep<CurrentStep>]>, Locals>
> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return mergeMap(async ({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const step = current.steps.at(-1);

    if (isSingleHttpTestCaseStep(step)) {
      step.transactions.push({
        requestTemplate: await ctx.generateRequest(
          ctx.format,
          step.source,
          options
        ),
        source: step.source,
      } as HttpTestCaseStepTransaction);
    } else if (isGroupedHttpTestCaseStep(step)) {
      for (const transaction of step.source.transactions) {
        step.transactions.push({
          requestTemplate: await ctx.generateRequest(
            ctx.format,
            transaction,
            options
          ),
          source: transaction,
        } as HttpTestCaseStepTransaction);
      }
    } else if (isCustomHttpTestCaseStep(step)) {
      ctx.logger.warn(
        'generateRequests was called on custom http test step which is not supported.'
      );
    }

    return { current, ctx };
  });
}
