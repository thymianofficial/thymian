import type { ThymianHttpResponse } from '@thymian/core';
import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';
import { validateResponse } from '../validate/index.js';
import { hasThymianResId } from './utils.js';

export function validateResponses<
  Steps extends HttpTestCaseStep[],
>(): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return mergeMap(async ({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const step = current.steps.at(-1);

    if (!step) {
      return { current, ctx };
    }

    for (const transaction of step.transactions) {
      if (!(transaction.response && hasThymianResId(transaction.source))) {
        continue;
      }

      const response = ctx.format.getNode<ThymianHttpResponse>(
        transaction.source.thymianResId,
      );

      if (!response) {
        continue;
      }

      const result = validateResponse(
        transaction.source.thymianRes,
        transaction.response,
        ctx.format
          .getHttpResponsesOf(transaction.source.thymianReqId)
          .map(([, response]) => response),
      );

      current.results.push(...result.results);

      if (!result.valid) {
        ctx.fail(current, 'Invalid response.');
      }
    }

    return { current, ctx };
  });
}
