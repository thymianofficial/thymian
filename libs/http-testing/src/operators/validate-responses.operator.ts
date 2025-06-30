import type { ThymianHttpResponse } from '@thymian/core';
import { mergeMap, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
} from '../http-test-case.js';
import { validateBodyForResponse } from '../validate/validate-body.js';
import { validateHeaders } from '../validate/validate-headers.js';
import { hasThymianResId } from './utils.js';

export type ValidateResponsesOptions = {
  body: boolean;
  headers: boolean;
  statusCode: boolean;
};

export function validateResponses<Steps extends HttpTestCaseStep[]>(
  opts: Partial<ValidateResponsesOptions> = {}
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return mergeMap(async ({ curr, ctx }) => {
    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }

    const options = {
      body: true,
      headers: true,
      statusCode: true,
      ...opts,
    };

    const step = curr.steps.at(-1);

    if (!step) {
      return { curr, ctx };
    }

    for (const transaction of step.transactions) {
      if (!(transaction.response && hasThymianResId(transaction.source))) {
        continue;
      }

      const response = ctx.format.getNode<ThymianHttpResponse>(
        transaction.source.thymianResId
      );

      if (!response) {
        continue;
      }

      const { body, headers, statusCode } = transaction.response;

      let correctStatusCode = true;

      if (options.statusCode) {
        if (statusCode !== response.statusCode) {
          correctStatusCode = false;
          curr.results.push({
            type: 'assertion-failure',
            message: `Expected status code ${response.statusCode}, but received ${statusCode}.`,
          });
        }
      }

      if (options.body && correctStatusCode) {
        curr.results.push(...validateBodyForResponse(body, response));
      }

      if (options.headers && correctStatusCode) {
        curr.results.push(...validateHeaders(headers, response));
      }
    }

    return { curr, ctx };
  });
}
