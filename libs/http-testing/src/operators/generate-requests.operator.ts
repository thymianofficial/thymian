import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isCustomHttpTestCaseStep,
  isFailedTestCase,
  isGroupedHttpTestCaseStep,
  isSingleHttpTestCaseStep,
  isSkippedTestCase,
} from '../http-test-case.js';

export function generateRequests<Steps extends HttpTestCaseStep[]>(
  amount = 1
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }

    const step = curr.steps.at(-1);

    console.log({ step });

    if (isSingleHttpTestCaseStep(step)) {
      for (let i = 0; i < amount; i++) {
        console.log(
          'generate request' +
            JSON.stringify(await ctx.generateRequest(ctx.format, step.source))
        );
        step.transactions.push({
          requestTemplate: await ctx.generateRequest(ctx.format, step.source),
          source: step.source,
        });
      }
    } else if (isGroupedHttpTestCaseStep(step)) {
      for (let i = 0; i < amount; i++) {
        for (const transaction of step.source.transactions) {
          step.transactions.push({
            requestTemplate: await ctx.generateRequest(ctx.format, transaction),
            source: transaction,
          });
        }
      }
    } else if (isCustomHttpTestCaseStep(step)) {
      ctx.logger.warn(
        'generateRequests was called on custom http test step which is not supported.'
      );
    }

    console.log({ step });

    return { curr, ctx };
  });
}
