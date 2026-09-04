import { thymianHttpTransactionToString } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  isSelector,
  selectorForTransaction,
} from '../src/selectors/selector.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';

/**
 * #46 / ADR-0020: the round-trip property that keeps "the label is the
 * Selector" honest.
 *
 * `thymianHttpTransactionToString` is the only thing `sampler check` — and
 * every other surface that names a Transaction — renders a line with, so
 * asserting on it here is asserting on what those surfaces print. The
 * end-to-end half of the claim (the line really reaching the terminal) is
 * `e2e-tests/src/cli-sampler-check.test.ts`.
 */
const format = createThymianFormatWithTransactions([
  [
    createHttpRequest({ method: 'GET', path: '/launches', mediaType: '' }),
    createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
  ],
  [
    createHttpRequest({
      method: 'POST',
      path: '/launches/{id}/crew-members',
      mediaType: 'application/json',
    }),
    createHttpResponse({ statusCode: 409, mediaType: '' }),
  ],
  [
    createHttpRequest({ method: 'DELETE', path: '/launches/{id}' }),
    createHttpResponse({ statusCode: 204, mediaType: '' }),
  ],
  // The same odd-but-legal constructs #9 pinned for the catalog: a label has to
  // survive everything a selector survives, or the round trip is only true for
  // the descriptions that were easy anyway.
  [
    createHttpRequest({
      method: 'POST',
      path: '/reports',
      mediaType: 'text/plain; format="a(b)"',
    }),
    createHttpResponse({
      statusCode: 200,
      mediaType: 'application/vnd.thymian+json; profile="x) y"',
    }),
  ],
  [
    createHttpRequest({ method: 'GE T', path: '/a b/c->d/{id}' }),
    createHttpResponse({ statusCode: 200, mediaType: '' }),
  ],
]);

describe('every printed transaction label', () => {
  const catalog = TransactionCatalog.fromThymianFormat(format);

  it('parses as a selector that resolves to the transaction it names', () => {
    const transactions = format.getThymianHttpTransactions();

    expect(transactions.length).toBe(5);

    for (const transaction of transactions) {
      const label = thymianHttpTransactionToString(
        transaction.thymianReq,
        transaction.thymianRes,
      );

      expect(isSelector(label)).toBe(true);
      expect(catalog.resolve(label).transactionId).toBe(
        transaction.transactionId,
      );
    }
  });

  it('is the selector the sampler would tell the user to anchor a hook to', () => {
    for (const transaction of format.getThymianHttpTransactions()) {
      expect(
        thymianHttpTransactionToString(
          transaction.thymianReq,
          transaction.thymianRes,
        ),
      ).toBe(selectorForTransaction(transaction));
    }
  });

  it('never carries a reason phrase', () => {
    const labels = format
      .getThymianHttpTransactions()
      .map((transaction) =>
        thymianHttpTransactionToString(
          transaction.thymianReq,
          transaction.thymianRes,
        ),
      );

    expect(labels).toEqual(
      expect.arrayContaining([
        'GET /launches -> 200 (application/json)',
        'POST /launches/{id}/crew-members (application/json) -> 409',
        'DELETE /launches/{id} -> 204',
      ]),
    );

    for (const label of labels) {
      expect(label).not.toMatch(/\b(OK|CREATED|CONFLICT|NO CONTENT)\b/);
    }
  });
});
