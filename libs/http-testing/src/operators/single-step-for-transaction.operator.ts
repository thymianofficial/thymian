import {
  type HttpTransaction,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
  type SingleHttpTestCaseStep,
} from '../http-test/index.js';

export function singleStepForTransaction<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  findTransaction: (previous: CurrentStep, format: ThymianFormat) => string,
  fn: (
    step: Observable<
      PipelineItem<
        HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
      >
    >
  ) => Observable<
    PipelineItem<HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>>
  >
): OperatorFunction<
  PipelineItem<HttpTestCase<[...Steps, CurrentStep]>>,
  PipelineItem<HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>>
> {
  return mergeMap(({ ctx, current }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return of({
        current: current as unknown as HttpTestCase<
          [...Steps, CurrentStep, SingleHttpTestCaseStep]
        >,
        ctx,
      });
    }

    const prevStep = current.steps.at(-1) as CurrentStep | undefined;

    if (typeof prevStep === 'undefined') {
      return of(
        ctx.fail(
          current,
          'Previous step must be defined.'
        ) as unknown as PipelineItem<
          HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
        >
      );
    }

    const transactionId = findTransaction(prevStep, ctx.format);
    const transaction = ctx.format.getEdge<HttpTransaction>(transactionId);
    const [thymianReqId, thymianResId] =
      ctx.format.graph.extremities(transactionId);
    const thymianReq = ctx.format.getNode<ThymianHttpRequest>(thymianReqId);
    const thymianRes = ctx.format.getNode<ThymianHttpResponse>(thymianResId);

    if (!thymianReq || !thymianRes || !transaction) {
      return of(
        ctx.fail(
          current,
          'Invalid HTTP transaction ID.'
        ) as unknown as PipelineItem<
          HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
        >
      );
    }

    const newStep: SingleHttpTestCaseStep = {
      type: 'single',
      source: {
        thymianReq,
        thymianReqId,
        thymianRes,
        thymianResId,
        transactionId,
        transaction,
      },
      transactions: [],
    };

    current.steps.push(newStep);

    return fn(
      of({
        ctx,
        current: current as unknown as HttpTestCase<
          [...Steps, CurrentStep, SingleHttpTestCaseStep]
        >,
      })
    );
  });
}
