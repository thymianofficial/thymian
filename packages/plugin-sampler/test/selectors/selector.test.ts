import type { ThymianError } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  formatSelector,
  parseSelector,
  selectorForTransaction,
} from '../../src/selectors/selector.js';

/**
 * Captures the error a synchronous call throws so its `name` and
 * `options.suggestions` can be asserted, mirroring the `.rejects.toMatchObject`
 * style used for async errors elsewhere in the workspace.
 */
function catchError(fn: () => unknown): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to throw, but it returned normally.');
}

describe('formatSelector', () => {
  it('renders the three specification examples byte-for-byte', () => {
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/launches', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
      ),
    ).toBe('GET /launches -> 200 (application/json)');

    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/astronauts',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode: 201, mediaType: 'application/json' }),
      ),
    ).toBe('POST /astronauts (application/json) -> 201 (application/json)');

    expect(
      formatSelector(
        createHttpRequest({
          method: 'DELETE',
          path: '/astronauts/{id}',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ),
    ).toBe('DELETE /astronauts/{id} -> 204');
  });

  it('never renders protocol, host or port', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        protocol: 'https',
        host: 'api.example.com',
        port: 8443,
        mediaType: '',
      }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    );

    expect(selector).toBe('GET /launches -> 200 (application/json)');
    expect(selector).not.toContain('api.example.com');
    expect(selector).not.toContain('8443');
    expect(selector).not.toContain('https');
  });

  it('renders host-identical transactions from different origins identically', () => {
    const response = createHttpResponse({
      statusCode: 200,
      mediaType: 'application/json',
    });

    expect(
      formatSelector(
        createHttpRequest({ path: '/users', host: 'a.example', mediaType: '' }),
        response,
      ),
    ).toBe(
      formatSelector(
        createHttpRequest({
          path: '/users',
          host: 'b.example',
          port: 9999,
          mediaType: '',
        }),
        response,
      ),
    );
  });

  it('guarantees a leading slash on the path without otherwise touching it', () => {
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: 'launches', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /launches -> 200');

    // basePath, trailing slash and percent-encoding are all emitted verbatim.
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/v1/pets/', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /v1/pets/ -> 200');

    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/a%20b', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /a%20b -> 200');
  });

  it('never renders query parameters into the path', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        mediaType: '',
        queryParameters: {
          limit: {
            schema: { type: 'number' },
            required: true,
            style: { style: 'form', explode: true },
          },
        },
      }),
      createHttpResponse({ statusCode: 200, mediaType: '' }),
    );

    expect(selector).toBe('GET /launches -> 200');
    expect(selector).not.toContain('limit');
  });

  it('uppercases a lowercase method', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'post',
          path: '/astronauts',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 201, mediaType: '' }),
      ),
    ).toBe('POST /astronauts -> 201');
  });

  it('gates each media part on mediaType, not on a body or schema', () => {
    // Both sides carry a media type but neither carries a body/schema.
    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/astronauts',
          mediaType: 'application/json',
          body: undefined,
        }),
        createHttpResponse({
          statusCode: 201,
          mediaType: 'application/json',
          schema: undefined,
        }),
      ),
    ).toBe('POST /astronauts (application/json) -> 201 (application/json)');

    // Empty media type is the "no media type" sentinel on both sides.
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/x', mediaType: '' }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ),
    ).toBe('GET /x -> 204');
  });

  it('keeps media type parameters verbatim', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/x',
          mediaType: 'application/json; charset=utf-8',
        }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/vnd.Example+JSON',
        }),
      ),
    ).toBe(
      'POST /x (application/json; charset=utf-8) -> 200 (application/vnd.Example+JSON)',
    );
  });

  it('refuses to render a selector that could not round-trip', () => {
    const response = createHttpResponse({ statusCode: 200, mediaType: '' });

    expect(
      catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a b', mediaType: '' }),
          response,
        ),
      ).name,
    ).toBe('MalformedSelectorError');

    expect(
      catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/search?q=a b', mediaType: '' }),
          response,
        ),
      ).name,
    ).toBe('MalformedSelectorError');

    expect(
      catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a->b', mediaType: '' }),
          response,
        ),
      ).name,
    ).toBe('MalformedSelectorError');

    expect(
      catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a', mediaType: 'application/json)' }),
          response,
        ),
      ).name,
    ).toBe('MalformedSelectorError');

    expect(
      catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a', mediaType: '' }),
          createHttpResponse({ statusCode: 200, mediaType: 'text/(plain)' }),
        ),
      ).name,
    ).toBe('MalformedSelectorError');
  });

  it('emits a traffic-derived query string verbatim when it is unambiguous', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'GET',
          path: '/search?q=apollo',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /search?q=apollo -> 200');
  });
});

describe('selectorForTransaction', () => {
  it('renders from the transaction request/response pair', () => {
    const format = createThymianFormatWithTransactions(1);
    const [transaction] = format.getThymianHttpTransactions();

    if (!transaction) {
      throw new Error('Fixture produced no transaction.');
    }

    expect(selectorForTransaction(transaction)).toBe(
      'GET /transaction-0 -> 200 (application/json)',
    );
  });
});

describe('parseSelector', () => {
  it('round-trips every transaction of a generated format', () => {
    const format = createThymianFormatWithTransactions(20);
    const transactions = format.getThymianHttpTransactions();

    expect(transactions).toHaveLength(20);

    for (const transaction of transactions) {
      const selector = selectorForTransaction(transaction);
      const parts = parseSelector(selector);

      expect(parts.method).toBe(transaction.thymianReq.method.toUpperCase());
      expect(parts.path).toBe(transaction.thymianReq.path);
      expect(parts.status).toBe(transaction.thymianRes.statusCode);
      expect(parts.requestMediaType).toBe(
        transaction.thymianReq.mediaType || undefined,
      );
      expect(parts.responseMediaType).toBe(
        transaction.thymianRes.mediaType || undefined,
      );
    }
  });

  it('round-trips media types that contain parameters', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'POST',
        path: '/x',
        mediaType: 'application/json; charset=utf-8',
      }),
      createHttpResponse({
        statusCode: 200,
        mediaType: 'application/json; charset=utf-8',
      }),
    );

    expect(parseSelector(selector)).toEqual({
      method: 'POST',
      path: '/x',
      requestMediaType: 'application/json; charset=utf-8',
      status: 200,
      responseMediaType: 'application/json; charset=utf-8',
    });
  });

  it.each([
    ['empty input', ''],
    ['no status', 'GET /x'],
    ['no method', '/x -> 200'],
    ['wrong arrow', 'GET /x => 200'],
    ['double spaces', 'GET /x  ->  200'],
    ['lowercase method', 'get /x -> 200'],
    ['unbalanced paren', 'GET /x -> 200 (application/json'],
    [
      "core's display string",
      'GET /launches - application/json → 200 OK - application/json',
    ],
  ])('refuses to parse %s', (_label, input) => {
    const error = catchError(() => parseSelector(input));

    expect(error.name).toBe('MalformedSelectorError');
    expect(error.message).toContain(input);
    expect(error.options.suggestions?.length).toBeGreaterThan(0);
  });

  it('suggests the uppercased form for a lowercase method', () => {
    const error = catchError(() => parseSelector('get /x -> 200'));

    expect(error.options.suggestions?.join('\n')).toContain('GET /x -> 200');
  });
});
