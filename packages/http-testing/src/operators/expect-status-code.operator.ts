import { zipArrays } from '@thymian/core';
import {
  type HttpStatusCodeRange,
  statusCodeMatchesRange,
} from '@thymian/core';
import { map, type MonoTypeOperatorFunction } from 'rxjs';

import {
  type HttpTestCase,
  type HttpTestCaseStep,
  isFailedTestCase,
  isSkippedTestCase,
  type PipelineItem,
} from '../http-test/index.js';

export function expectStatusCode<Steps extends HttpTestCaseStep[]>(
  statusCode: number | HttpStatusCodeRange | (number | HttpStatusCodeRange)[],
): MonoTypeOperatorFunction<PipelineItem<HttpTestCase<Steps>>> {
  return map(({ current, ctx }) => {
    if (isSkippedTestCase(current) || isFailedTestCase(current)) {
      return { current, ctx };
    }
    const step = current.steps.at(-1);

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
            current.results.push({
              type: 'assertion-failure',
              message: `Expected status code ${statusCode} but got ${transaction.response.statusCode}`,
              timestamp: Date.now(),
              actual: transaction.response.statusCode,
              expected: statusCode,
              assertion: '===',
            });
            current.status = 'failed';
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
            current.results.push({
              type: 'assertion-failure',
              message: `Expected status code ${statusCode} but got ${transaction.response.statusCode}`,
              timestamp: Date.now(),
              actual: transaction.response.statusCode,
              expected: statusCode,
              assertion: '===',
            });
            current.status = 'failed';
          }
        });
      }
    }

    return { current, ctx };
  });
}
