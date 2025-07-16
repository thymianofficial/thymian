import {
  type HttpStatusCodeRange,
  statusCodeMatchesRange,
} from '@thymian/http-status-codes';
import { map, type MonoTypeOperatorFunction } from 'rxjs';

import type { HttpTestInstance } from '../http-test.js';
import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
} from '../http-test-case.js';
import { zipArrays } from '@thymian/core';

export function expectStatusCode<Steps extends HttpTestCaseStep[]>(
  statusCode: number | HttpStatusCodeRange | (number | HttpStatusCodeRange)[]
): MonoTypeOperatorFunction<HttpTestInstance<HttpTestCase<Steps>>> {
  return map(({ curr, ctx }) => {
    if (isSkippedTestCase(curr) || isFailedTestCase(curr)) {
      return { curr, ctx };
    }
    const step = curr.steps.at(-1);

    if (step) {
      if (Array.isArray(statusCode)) {
        const transactionsAndCodes = zipArrays(step.transactions, statusCode);

        for (const [transaction, statusCode] of transactionsAndCodes) {
          const isValidStatusCode =
            typeof statusCode === 'number'
              ? (code: number) => code === statusCode
              : (code: number) => statusCodeMatchesRange(code, statusCode);

          if (
            transaction.response &&
            !isValidStatusCode(transaction.response.statusCode)
          ) {
            curr.results.push({
              type: 'assertion-failure',
              message: `Expected status code ${statusCode} but got ${transaction.response.statusCode}.`,
            });
            curr.status = 'failed';
          }
        }
      } else {
        const isValidStatusCode =
          typeof statusCode === 'number'
            ? (code: number) => code === statusCode
            : (code: number) => statusCodeMatchesRange(code, statusCode);

        step.transactions.forEach((transaction) => {
          if (
            transaction.response &&
            !isValidStatusCode(transaction.response.statusCode)
          ) {
            curr.results.push({
              type: 'assertion-failure',
              message: `Expected status code ${statusCode} but got ${transaction.response.statusCode}`,
            });
            curr.status = 'failed';
          }
        });
      }
    }

    return { curr, ctx };
  });
}
