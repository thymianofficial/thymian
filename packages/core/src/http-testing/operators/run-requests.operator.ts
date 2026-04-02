import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import { thymianHttpTransactionToString } from '../../index.js';
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
  authorize: boolean;
};

export function runRequests<
  Steps extends HttpTestCaseStep[],
  Locals extends HttpTestContextLocals,
>(
  opts: Partial<RunRequestsOptions> = {},
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>, Locals>> {
  return mergeMap(async ({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }

    const options: RunRequestsOptions = {
      checkResponse: false,
      checkStatusCode: true,
      checkBody: false,
      checkHeaders: false,
      authorize: true,
      ...opts,
    };

    const stepIdx = current.steps.length - 1;
    const step = current.steps.at(stepIdx);

    if (step) {
      if (step.transactions.length === 0) {
        ctx.logger.warn(
          `Test case ${current.name} does not contain any transactions to run requests for.`,
        );
      }

      for (const transaction of step.transactions) {
        const transactionName = transaction.source
          ? thymianHttpTransactionToString(
              transaction.source.thymianReq,
              transaction.source.thymianRes,
            )
          : transaction.requestTemplate.method.toUpperCase() +
            ' ' +
            new URL(
              transaction.requestTemplate.path,
              transaction.requestTemplate.origin,
            ).toString();

        ctx.logger.debug(
          `Running "beforeRequest" hook for transaction ${transactionName} in test case ${current.name}.`,
        );

        const beforeRequest = await ctx.runHook('beforeRequest', {
          value: transaction.requestTemplate,
          ctx: transaction.source,
        });

        current.results.push(...(beforeRequest.testResults ?? []));

        if (beforeRequest.skip) {
          ctx.logger.debug(
            `Skipping test case "${current.name}" after "beforeEach" hook.`,
          );

          return ctx.skip(current, beforeRequest.skip);
        }

        if (beforeRequest.fail) {
          ctx.logger.debug(
            `Test case ${current.name} failed after "beforeEach" hook.`,
          );

          return ctx.fail(current, beforeRequest.fail);
        }

        transaction.requestTemplate =
          beforeRequest.result ?? transaction.requestTemplate;

        if (options.authorize && transaction.requestTemplate.authorize) {
          ctx.logger.debug(
            `Running "authorize" hook for transaction ${transactionName} in test case ${current.name}.`,
          );

          transaction.requestTemplate =
            (
              await ctx.runHook('authorize', {
                value: transaction.requestTemplate,
                ctx: transaction.source,
              })
            ).result ?? transaction.requestTemplate;
        }

        transaction.request = serializeRequest(transaction);
        transaction.response = await ctx.runRequest(transaction.request);

        const afterResponse = await ctx.runHook('afterResponse', {
          value: transaction.response,
          ctx: {
            request: transaction.request,
            requestTemplate: transaction.requestTemplate,
            thymianTransaction: transaction.source,
          },
        });

        current.results.push(...(afterResponse.testResults ?? []));

        if (afterResponse.skip) {
          ctx.logger.debug(
            `Skipping test case "${current.name}" after "afterEach" hook.`,
          );

          return ctx.skip(current, afterResponse.skip);
        }

        if (afterResponse.fail) {
          ctx.logger.debug(
            `Skipping test case "${current.name}" after "afterEach" hook.`,
          );

          return ctx.fail(current, afterResponse.fail);
        }

        transaction.response = afterResponse.result ?? transaction.response;

        if (typeof options.expectStatusCode !== 'undefined') {
          if (transaction.response.statusCode !== options.expectStatusCode) {
            const message = `Expected status code ${options.expectStatusCode}, but received ${transaction.response.statusCode}.`;

            current.results.push({
              type: 'invalid-transaction',
              message,
              transaction: transaction.source,
              timestamp: Date.now(),
              details:
                'In most cases, this is because the http-testing module has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.',
            });

            return ctx.skip(current, message);
          }
        } else if (transaction.source) {
          const results: HttpTestCaseResult[] = [];

          if (options.checkStatusCode || options.checkResponse) {
            const result = validateStatusCode(
              transaction.source.thymianRes.statusCode,
              transaction.response.statusCode,
              ctx.format
                .getHttpResponsesOf(transaction.source.thymianReqId)
                .map(([, { statusCode }]) => statusCode),
            );

            if (result.type === 'assertion-failure') {
              current.results.push({
                type: 'invalid-transaction',
                message: result.message,
                transaction: transaction.source,
                timestamp: result.timestamp,
                details:
                  'In most cases, this is because the http-testing module has failed to generate syntactic and/or semantic correct test data. You can either specify samples directly in your API description or provide valid samples via hooks.',
              });

              return ctx.skip(current, result.message);
            }

            results.push(result);
          }

          if (
            options.checkBody ||
            (options.checkResponse &&
              typeof transaction.response.body !== 'undefined')
          ) {
            results.push(
              ...validateBodyForResponse(
                transaction.response.body,
                transaction.source.thymianRes,
              ),
            );
          }

          if (options.checkHeaders || options.checkResponse) {
            results.push(
              ...validateHeaders(
                transaction.response.headers,
                transaction.source.thymianRes,
              ),
            );
          }

          const valid = !results.some((r) => r.type === 'assertion-failure');

          if (!valid) {
            current.results.push(
              ...results.map((r) => {
                if (r.type === 'assertion-failure') {
                  r.transaction = transaction.source;
                }

                return r;
              }),
            );

            return ctx.fail(current);
          }
        }
      }
    } else {
      ctx.logger.warn(
        `Test case ${current.name} does not contain any steps to run requests for.`,
      );
    }

    return { current, ctx };
  });
}
