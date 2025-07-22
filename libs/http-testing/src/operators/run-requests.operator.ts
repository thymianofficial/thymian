import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseResult,
  type HttpTestCaseStep,
  type HttpTestContextLocals,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';
import { serializeRequest } from '../serialize-request.js';
import {
  validateBodyForResponse,
  validateHeaders,
  validateResponse,
  validateStatusCode,
} from '../validate/index.js';

export type RunRequestsOptions = {
  checkResponse: boolean;
  checkStatusCode: boolean;
  checkHeaders: boolean;
  checkBody: boolean;
  expectStatusCode?: number;
};

export function runRequests<
  Steps extends HttpTestCaseStep[],
  Locals extends HttpTestContextLocals
>(
  opts: Partial<RunRequestsOptions> = {}
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>, Locals>> {
  return mergeMap(async ({ current, ctx }) => {
    const options: RunRequestsOptions = {
      checkResponse: false,
      checkStatusCode: true,
      checkBody: false,
      checkHeaders: false,
      ...opts,
    };

    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const step = current.steps.at(-1);

    if (step) {
      for (const transaction of step.transactions) {
        transaction.request = serializeRequest(transaction);
        transaction.response = await ctx.runRequest(transaction.request);

        if (typeof options.expectStatusCode !== 'undefined') {
          if (transaction.response.statusCode !== options.expectStatusCode) {
            const message = `Expected status code ${options.expectStatusCode} but got ${transaction.response.statusCode}.`;

            current.results.push({
              type: 'invalid-transaction',
              message,
              transaction: transaction.source,
              timestamp: Date.now(),
              details:
                'In most cases, this is because @thymian/http-testing has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.',
            });

            return ctx.skip(current, message);
          }
        } else if (options.checkResponse && transaction.source) {
          const results: HttpTestCaseResult[] = [];

          if (options.checkHeaders || options.checkResponse) {
            results.push(
              ...validateStatusCode(
                transaction.source.thymianRes.statusCode,
                transaction.response.statusCode
              )
            );
          }

          if (options.checkBody || options.checkResponse) {
            results.push(
              ...validateBodyForResponse(
                transaction.response.body,
                transaction.source.thymianRes
              )
            );
          }

          if (options.checkHeaders || options.checkResponse) {
            results.push(
              ...validateHeaders(
                transaction.response.headers,
                transaction.source.thymianRes
              )
            );
          }

          const valid = results.some((r) => r.type === 'assertion-failure');

          if (!valid) {
            const message = `Received in invalid response. See test results for more details.`;

            current.results.push({
              type: 'invalid-transaction',
              message,
              transaction: transaction.source,
              timestamp: Date.now(),
              details:
                'In most cases, this is because Thymian has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.',
            });

            current.results.push(...results);

            return ctx.skip(current, message);
          }
        }
      }
    }

    return { current, ctx };
  });
}
