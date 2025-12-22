import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';
import { ThymianFormat } from '@thymian/core';

import { createHttpRequest } from './http-request.factory.js';
import { createHttpResponse } from './http-response.factory.js';

/**
 * Creates an empty ThymianFormat instance.
 *
 * @returns A new ThymianFormat instance
 *
 * @example
 * ```typescript
 * const format = createThymianFormat();
 * format.addHttpTransaction(request, response);
 * ```
 */
export function createThymianFormat(): ThymianFormat {
  return new ThymianFormat();
}

/**
 * Creates a ThymianFormat with a single HTTP transaction.
 *
 * @param request - Optional request override
 * @param response - Optional response override
 * @returns A ThymianFormat with one transaction
 *
 * @example
 * ```typescript
 * const format = createThymianFormatWithTransaction(
 *   createGetRequest({ path: '/users' }),
 *   createOkResponse()
 * );
 * ```
 */
export function createThymianFormatWithTransaction(
  request: ThymianHttpRequest = createHttpRequest(),
  response: ThymianHttpResponse = createHttpResponse(),
): ThymianFormat {
  const format = new ThymianFormat();
  format.addHttpTransaction(request, response);
  return format;
}

/**
 * Creates a ThymianFormat with multiple HTTP transactions.
 *
 * @param transactions - Array of [request, response] tuples
 * @returns A ThymianFormat with multiple transactions
 *
 * @example
 * ```typescript
 * const format = createThymianFormatWithTransactions([
 *   [createGetRequest({ path: '/users' }), createOkResponse()],
 *   [createPostRequest({ path: '/users' }), createCreatedResponse()],
 * ]);
 * ```
 */
export function createThymianFormatWithTransactions(
  transactions: Array<[ThymianHttpRequest, ThymianHttpResponse]> | number,
): ThymianFormat {
  const format = new ThymianFormat();

  if (typeof transactions === 'number') {
    transactions = Array.from({ length: transactions }, (_, i) => [
      createHttpRequest({ path: `/transaction-${i}` }),
      createHttpResponse(),
    ]);
  }

  for (const [request, response] of transactions) {
    format.addHttpTransaction(request, response);
  }
  return format;
}
