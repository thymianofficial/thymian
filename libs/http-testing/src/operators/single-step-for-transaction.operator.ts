import {
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { mergeMap, type Observable, of, type OperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import type {
  HttpTestCase,
  HttpTestCaseStep,
  SingleHttpTestCaseStep,
} from '../http-test-case.js';

export function singleStepForTransaction<
  Steps extends HttpTestCaseStep[],
  CurrentStep extends HttpTestCaseStep
>(
  findTransaction: (previous: CurrentStep, format: ThymianFormat) => string,
  fn: (
    step: Observable<
      HttpTestInstance<
        HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
      >
    >
  ) => Observable<
    HttpTestInstance<
      HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
    >
  >
): OperatorFunction<
  HttpTestInstance<HttpTestCase<[...Steps, CurrentStep]>>,
  HttpTestInstance<
    HttpTestCase<[...Steps, CurrentStep, SingleHttpTestCaseStep]>
  >
> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return mergeMap(({ ctx, curr }) => {
    const prevStep = curr.steps.at(-1) as CurrentStep | undefined;

    if (typeof prevStep === 'undefined') {
      return ctx.fail(curr, 'Previous step must be defined.');
    }

    const transactionId = findTransaction(prevStep, ctx.format);
    const [thymianReqId, thymianResId] =
      ctx.format.graph.extremities(transactionId);
    const thymianReq = ctx.format.getNode<ThymianHttpRequest>(thymianReqId);
    const thymianRes = ctx.format.getNode<ThymianHttpResponse>(thymianResId);

    if (!thymianReq || !thymianRes) {
      return ctx.fail(curr, 'Invalid HTTP transaction ID.');
    }

    const newStep: SingleHttpTestCaseStep = {
      type: 'single',
      source: {
        thymianReq,
        thymianReqId,
        thymianRes,
        thymianResId,
        transactionId,
      },
      transactions: [],
    };

    curr.steps.push(newStep);

    return fn(
      of({
        ctx,
        curr: curr as unknown as HttpTestCase<
          [...Steps, CurrentStep, SingleHttpTestCaseStep]
        >,
      })
    );
  });
}
