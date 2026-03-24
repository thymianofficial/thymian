import { mergeMap, type OperatorFunction } from 'rxjs';

import type { PartialExceptFor } from '../../index.js';
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
          >,
        ]
      >
    : Step;

export function generateRequests<
  PreviousSteps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep,
  Locals extends HttpTestContextLocals,
>(
  options?: GenerateRequestsOptions,
): OperatorFunction<
  PipelineItem<HttpTestCase<[...PreviousSteps, CurrentStep]>, Locals>,
  PipelineItem<HttpTestCase<[...PreviousSteps, InferStep<CurrentStep>]>, Locals>
> {
  return mergeMap(async ({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return {
        current: current as HttpTestCase<
          [...PreviousSteps, InferStep<CurrentStep>]
        >,
        ctx,
      };
    }

    const step = current.steps.at(-1);

    if (isSingleHttpTestCaseStep(step)) {
      const template = await ctx.sampleRequest(step.source);

      if (typeof template === 'undefined') {
        throw new Error(
          'Failed to generate request template for transactions: ' +
            JSON.stringify(step.source),
        );
      }

      step.transactions.push({
        requestTemplate: {
          ...template,
          authorize: options?.authenticate ?? template.authorize,
        },
        source: step.source,
      });
    } else if (isGroupedHttpTestCaseStep(step)) {
      for (const transaction of step.source.transactions) {
        step.transactions.push({
          requestTemplate: await ctx.sampleRequest(transaction),
          source: transaction,
        } as HttpTestCaseStepTransaction);
      }
    } else if (isCustomHttpTestCaseStep(step)) {
      ctx.logger.warn(
        'generateRequests was called on custom http test step which is not supported.',
      );
    }

    return {
      current: current as HttpTestCase<
        [...PreviousSteps, InferStep<CurrentStep>]
      >,
      ctx,
    };
  });
}
