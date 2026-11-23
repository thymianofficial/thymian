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
 * Adds an HTTP transaction to a ThymianFormat and returns its id, which is how
 * a test names the transaction from then on.
 *
 * Adding a second response to the same request gives a second transaction on
 * that request: one operation with two answers.
 *
 * @param format - The format to add the transaction to
 * @param request - The request of the transaction
 * @param response - The response of the transaction
 * @returns The id of the added transaction
 *
 * @example
 * ```typescript
 * const format = createThymianFormat();
 * const createAstronaut = createPostRequest({ path: '/astronauts' });
 * const astronautCreated = addTransaction(format, createAstronaut, createCreatedResponse());
 * const astronautRejected = addTransaction(format, createAstronaut, createBadRequestResponse());
 * ```
 */
export function addTransaction(
  format: ThymianFormat,
  request: Parameters<ThymianFormat['addHttpTransaction']>[0],
  response: Parameters<ThymianFormat['addHttpTransaction']>[1],
): string {
  const [, , transactionId] = format.addHttpTransaction(
    request,
    response,
    'test-source',
  );
  return transactionId;
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
  format.addHttpTransaction(request, response, 'test-source');
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
    format.addHttpTransaction(request, response, 'test-source');
  }
  return format;
}
