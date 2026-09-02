import { ThymianFormat } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormat,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { TransactionCatalog } from '../../src/selectors/transaction-catalog.js';

function suggestionsOf(e: unknown): string[] {
  return (
    (e as { options?: { suggestions?: string[] } }).options?.suggestions ?? []
  );
}

describe('TransactionCatalog', () => {
  it('is a bijection between selectors and transactions', () => {
    const format = createThymianFormatWithTransactions([
      [
        createHttpRequest({ method: 'GET', path: '/launches' }),
        createHttpResponse(),
      ],
      [
        createHttpRequest({
          method: 'POST',
          path: '/launches',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode: 201 }),
      ],
      [
        createHttpRequest({ method: 'DELETE', path: '/launches/{id}' }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ],
    ]);
    const catalog = TransactionCatalog.fromThymianFormat(format);

    expect(catalog.size).toBe(3);

    const transactionIds = new Set<string>();

    for (const [selector, transaction] of catalog.entries()) {
      expect(catalog.resolve(selector)).toBe(transaction);
      // One selector per transaction, and one transaction per selector.
      expect(transactionIds.has(transaction.transactionId)).toBe(false);
      transactionIds.add(transaction.transactionId);
    }

    expect(transactionIds.size).toBe(catalog.size);
  });

  it('iterates sorted by selector, whatever order the document had', () => {
    const pairs: Array<
      [
        ReturnType<typeof createHttpRequest>,
        ReturnType<typeof createHttpResponse>,
      ]
    > = [
      [
        createHttpRequest({
          method: 'POST',
          path: '/zebras',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode: 201 }),
      ],
      [
        createHttpRequest({ method: 'GET', path: '/apples' }),
        createHttpResponse(),
      ],
      [
        createHttpRequest({ method: 'DELETE', path: '/mangos' }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ],
    ];

    const forward = TransactionCatalog.fromThymianFormat(
      createThymianFormatWithTransactions(pairs),
    ).selectors();
    const reversed = TransactionCatalog.fromThymianFormat(
      createThymianFormatWithTransactions([...pairs].reverse()),
    ).selectors();

    expect(forward).toEqual([...forward].sort());
    // The point of sorting: reordering the source document is a non-event.
    expect(reversed).toEqual(forward);
  });

  it('reports a collision naming both sides and where they came from', () => {
    // Two sources describing the same method, path, status and media types.
    // A selector is host-stripped, so the two are indistinguishable.
    const format = new ThymianFormat();
    format.addHttpTransaction(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        host: 'staging.example.com',
      }),
      createHttpResponse({ sourceName: 'Staging API' }),
      'Staging API',
    );
    format.addHttpTransaction(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        host: 'prod.example.com',
      }),
      createHttpResponse({ sourceName: 'Production API' }),
      'Production API',
    );

    let error: unknown;

    try {
      TransactionCatalog.fromThymianFormat(format);
    } catch (e) {
      error = e;
    }

    expect((error as Error).message).toContain(
      'Two transactions resolve to the same selector',
    );
    const suggestions = suggestionsOf(error).join('\n');
    expect(suggestions).toContain('Staging API');
    expect(suggestions).toContain('Production API');
    expect(suggestions).toContain('load those sources separately');
  });

  it('offers nearest matches for a well-formed but unknown selector', () => {
    const format = createThymianFormatWithTransactions([
      [
        createHttpRequest({ method: 'GET', path: '/launches' }),
        createHttpResponse(),
      ],
      [
        createHttpRequest({
          method: 'POST',
          path: '/launches',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode: 201 }),
      ],
    ]);
    const catalog = TransactionCatalog.fromThymianFormat(format);

    let error: unknown;

    try {
      catalog.resolve('GET /launches -> 418 (application/json)');
    } catch (e) {
      error = e;
    }

    expect((error as Error).message).toContain('No transaction matches');
    const suggestions = suggestionsOf(error);
    expect(suggestions[0]).toBe('Did you mean one of these selectors?');
    // Same method and path first, then the same path under another method.
    expect(suggestions[1]).toBe('"GET /launches -> 200 (application/json)"');
    expect(suggestions).toContain(
      '"POST /launches (application/json) -> 201 (application/json)"',
    );
  });

  it('says nothing is loaded rather than blaming the path, when nothing is', () => {
    const catalog = TransactionCatalog.fromThymianFormat(createThymianFormat());

    expect(() => catalog.resolve('GET /launches -> 200')).toThrowError(
      /No transaction matches/,
    );

    try {
      catalog.resolve('GET /launches -> 200');
    } catch (e) {
      expect(suggestionsOf(e)[0]).toContain('No transactions are loaded');
    }
  });

  it('rejects a malformed selector as malformed, not as unknown', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      createThymianFormatWithTransactions(1),
    );

    expect(() => catalog.resolve('not a selector')).toThrowError(
      /is not a valid transaction selector/,
    );
  });

  it('answers a miss without throwing when a miss is expected', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      createThymianFormatWithTransactions(1),
    );

    expect(catalog.tryResolve('GET /nope -> 200')).toBeUndefined();
  });
});
