import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
} from '../http-test-case.js';
import { serializeRequest } from '../serialize-request.js';

export type RunRequestsOptions = {
  checkStatusCode: boolean;
};

export function runRequests<Steps extends HttpTestCaseStep[]>(
  opts: Partial<RunRequestsOptions> = {}
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    const options: RunRequestsOptions = {
      checkStatusCode: true,
      ...opts,
    };

    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }

    const step = curr.steps.at(-1);

    if (step) {
      for (const transaction of step.transactions) {
        transaction.request = serializeRequest(transaction);
        transaction.response = await ctx.runRequest(transaction.request);

        if (options.checkStatusCode && transaction.source?.thymianRes) {
          const res = transaction.source.thymianRes;
          const req = transaction.source.thymianReq;

          if (res.statusCode !== transaction.response.statusCode) {
            return ctx.skip(
              curr,
              `Trying to receive a response with code ${
                res.statusCode
              } for request ${req.method.toUpperCase()} ${req.path}${
                req.mediaType ? ' - ' + req.mediaType : ''
              }, but a ${
                transaction.response.statusCode
              } response was received. In most cases, this is because Thymian has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.`
            );
          }
        }
      }
    }

    return { curr, ctx };
  });
}
