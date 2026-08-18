import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  type ThymianError,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { TransactionCatalog } from '../../src/selectors/transaction-catalog.js';

function catchError(fn: () => unknown): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to throw, but it returned normally.');
}

type TransactionSpec = {
  method: string;
  path: string;
  requestMediaType?: string;
  status: number;
  responseMediaType?: string;
  host?: string;
  source?: string;
};

/**
 * Hand-builds a format from explicit request/response literals. The generated
 * `createThymianFormatWithTransactions` fixture cannot express differing hosts,
 * media types or sources, which is what the collision and media-variant cases
 * are about.
 */
function formatFrom(specs: TransactionSpec[]): ThymianFormat {
  const format = new ThymianFormat();

  for (const spec of specs) {
    const source = spec.source ?? 'test-source';
    const request: ThymianHttpRequest = createHttpRequest({
      method: spec.method,
      path: spec.path,
      host: spec.host ?? 'localhost',
      port: 8080,
      protocol: 'http',
      mediaType: spec.requestMediaType ?? '',
      sourceName: source,
    });
    const response: ThymianHttpResponse = createHttpResponse({
      statusCode: spec.status,
      mediaType: spec.responseMediaType ?? '',
      sourceName: source,
    });

    format.addHttpTransaction(request, response, source);
  }

  return format;
}

const baseSpecs: TransactionSpec[] = [
  {
    method: 'GET',
    path: '/launches',
    status: 200,
    responseMediaType: 'application/json',
  },
  {
    method: 'POST',
    path: '/astronauts',
    requestMediaType: 'application/json',
    status: 201,
    responseMediaType: 'application/json',
  },
  { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
];

describe('TransactionCatalog', () => {
  it('is bijective over every transaction of the format', () => {
    const format = createThymianFormatWithTransactions(20);
    const transactions = format.getThymianHttpTransactions();
    const catalog = TransactionCatalog.fromThymianFormat(format);

    expect(catalog.size).toBe(transactions.length);
    expect(catalog.selectors()).toHaveLength(transactions.length);
    expect(new Set(catalog.selectors()).size).toBe(transactions.length);

    for (const selector of catalog.selectors()) {
      const resolved = catalog.resolve(selector);

      expect(catalog.selectorFor(resolved.transactionId)).toBe(selector);
    }

    for (const transaction of transactions) {
      const selector = catalog.selectorFor(transaction.transactionId);

      expect(selector).toBeDefined();
      expect(catalog.resolve(String(selector)).transactionId).toBe(
        transaction.transactionId,
      );
    }

    expect(catalog.entries()).toHaveLength(transactions.length);
  });

  it('mirrors getThymianHttpTransactions order and is stable across builds', () => {
    const format = createThymianFormatWithTransactions(20);
    const first = TransactionCatalog.fromThymianFormat(format);
    const second = TransactionCatalog.fromThymianFormat(format);

    expect(second.selectors()).toEqual(first.selectors());
    expect(first.selectors()).toEqual(
      format
        .getThymianHttpTransactions()
        .map((transaction) => first.selectorFor(transaction.transactionId)),
    );
  });

  it('keeps every pre-existing selector byte-identical under additive change', () => {
    const before = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));
    const after = TransactionCatalog.fromThymianFormat(
      formatFrom([
        ...baseSpecs,
        // an added response status on an existing operation
        {
          method: 'GET',
          path: '/launches',
          status: 404,
          responseMediaType: 'application/problem+json',
        },
        // an added response media type on an existing operation
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/xml',
        },
      ]),
    );

    expect(after.size).toBe(before.size + 2);

    for (const selector of before.selectors()) {
      expect(after.selectors()).toContain(selector);

      const wasResolved = before.resolve(selector);
      const isResolved = after.resolve(selector);

      expect(isResolved.thymianReq.method).toBe(wasResolved.thymianReq.method);
      expect(isResolved.thymianReq.path).toBe(wasResolved.thymianReq.path);
      expect(isResolved.thymianReq.mediaType).toBe(
        wasResolved.thymianReq.mediaType,
      );
      expect(isResolved.thymianRes.statusCode).toBe(
        wasResolved.thymianRes.statusCode,
      );
      expect(isResolved.thymianRes.mediaType).toBe(
        wasResolved.thymianRes.mediaType,
      );
    }
  });

  it('distinguishes transactions that differ only in request media type', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 201,
        },
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/xml',
          status: 201,
        },
      ]),
    );

    expect(catalog.size).toBe(2);
    expect(
      catalog.resolve('POST /astronauts (application/json) -> 201').thymianReq
        .mediaType,
    ).toBe('application/json');
    expect(
      catalog.resolve('POST /astronauts (application/xml) -> 201').thymianReq
        .mediaType,
    ).toBe('application/xml');
  });

  it('distinguishes transactions that differ only in response media type', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/json',
        },
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/xml',
        },
      ]),
    );

    expect(catalog.size).toBe(2);
    expect(
      catalog.resolve('GET /launches -> 200 (application/json)').thymianRes
        .mediaType,
    ).toBe('application/json');
    expect(
      catalog.resolve('GET /launches -> 200 (application/xml)').thymianRes
        .mediaType,
    ).toBe('application/xml');
  });

  it('throws SelectorCollisionError naming both sources', () => {
    const format = formatFrom([
      {
        method: 'GET',
        path: '/users',
        status: 200,
        responseMediaType: 'application/json',
        host: 'api.one.example',
        source: 'source-one',
      },
      {
        method: 'GET',
        path: '/users',
        status: 200,
        responseMediaType: 'application/json',
        host: 'api.two.example',
        source: 'source-two',
      },
    ]);

    // The fixture must really carry two transactions — byte-identical
    // operations collapse into a single edge upstream and would assert nothing.
    expect(format.getThymianHttpTransactions()).toHaveLength(2);

    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(format),
    );

    expect(error.name).toBe('SelectorCollisionError');
    expect(error.message).toContain('GET /users -> 200 (application/json)');

    const suggestions = (error.options.suggestions ?? []).join('\n');

    expect(suggestions).toContain('source-one');
    expect(suggestions).toContain('source-two');
    expect(suggestions).toContain('http://api.one.example:8080');
    expect(suggestions).toContain('http://api.two.example:8080');
    expect(suggestions).toContain('Load the sources separately');
  });

  it('reports a dangling but well-formed selector with near-miss suggestions', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));
    const dangling = 'GET /launches -> 418 (application/json)';

    const error = catchError(() => catalog.resolve(dangling));

    expect(error.name).toBe('UnknownSelectorError');
    expect(error.message).toContain(dangling);
    expect((error.options.suggestions ?? []).join('\n')).toContain(
      'GET /launches -> 200 (application/json)',
    );
    expect(catalog.tryResolve(dangling)).toBeUndefined();
  });

  it('ranks same-method candidates before same-path candidates and caps at five', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        { method: 'POST', path: '/launches', status: 201 },
        { method: 'GET', path: '/launches', status: 200 },
        { method: 'GET', path: '/launches', status: 404 },
        { method: 'GET', path: '/launches', status: 500 },
        { method: 'GET', path: '/launches', status: 503 },
        { method: 'GET', path: '/launches', status: 502 },
        { method: 'GET', path: '/other', status: 200 },
      ]),
    );

    const error = catchError(() => catalog.resolve('GET /launches -> 418'));
    const candidates = (error.options.suggestions ?? []).filter((suggestion) =>
      suggestion.includes('/launches'),
    );

    expect(candidates).toHaveLength(5);
    expect(candidates.every((candidate) => candidate.includes('GET'))).toBe(
      true,
    );
    expect(candidates.some((candidate) => candidate.includes('/other'))).toBe(
      false,
    );
  });

  it('omits the candidate list when nothing shares the path', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    const error = catchError(() => catalog.resolve('GET /nowhere -> 200'));

    expect(error.name).toBe('UnknownSelectorError');
    expect((error.options.suggestions ?? []).join('\n')).not.toContain('->');
  });

  it('throws MalformedSelectorError for input that is not a selector', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    expect(
      catchError(() =>
        catalog.resolve('GET /launches - application/json → 200 OK'),
      ).name,
    ).toBe('MalformedSelectorError');
    expect(
      catalog.tryResolve('GET /launches - application/json → 200 OK'),
    ).toBeUndefined();
  });

  it('returns undefined from selectorFor for an unknown transaction id', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    expect(catalog.selectorFor('not-a-transaction-id')).toBeUndefined();
  });

  it('never reaches the filesystem or the samples tree', () => {
    const sources = [
      'selector.ts',
      'selector-errors.ts',
      'transaction-catalog.ts',
    ].map((file) =>
      readFileSync(
        fileURLToPath(new URL(`../../src/selectors/${file}`, import.meta.url)),
        'utf-8',
      ),
    );

    for (const source of sources) {
      expect(source).not.toMatch(/from\s+'node:fs/);
      expect(source).not.toMatch(/samples-structure/);
    }
  });
});
