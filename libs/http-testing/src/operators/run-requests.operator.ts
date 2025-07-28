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
            const message = `Expected status code ${options.expectStatusCode}, but received ${transaction.response.statusCode}.`;

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

          if (options.checkStatusCode || options.checkResponse) {
            const result = validateStatusCode(
              transaction.source.thymianRes.statusCode,
              transaction.response.statusCode
            );

            if (result.type === 'assertion-failure') {
              current.results.push({
                type: 'invalid-transaction',
                message: result.message,
                transaction: transaction.source,
                timestamp: result.timestamp,
                details:
                  'In most cases, this is because @thymian/http-testing has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.',
              });

              return ctx.skip(current, result.message);
            }

            results.push(result);
          }

          if (
            options.checkBody ||
            options.checkResponse ||
            typeof transaction.response.body !== 'undefined'
          ) {
            results.push(
              ...validateBodyForResponse(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                transaction.response.body!,
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
            current.results.push(
              ...results.map((r) => {
                if (r.type === 'assertion-failure') {
                  r.transaction = transaction.source;
                }

                return r;
              })
            );

            return ctx.fail(current);
          }
        }
      }
    } else {
      ctx.logger.warn(
        `Test case ${current.name} does not contain any steps to run requests for.`
      );
    }

    return { current, ctx };
  });
}
