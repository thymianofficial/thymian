import type {
  CapturedTransaction,
  HttpResponse,
  RuleFnResult,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './sender-may-send-etag-in-trailer.rule.js';

// The specification describes GET /rocket-types answered with
// `describedStatusCode`; every request is answered with `response`.
function runTest(
  response: HttpResponse,
  describedStatusCode = 200,
): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: describedStatusCode }),
    ),
    runRequest: async () => response,
  });
}

function transaction(response: {
  statusCode?: number;
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
}): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/rocket-types',
        headers: {},
      },
      meta: { role: 'user-agent' },
    },
    response: {
      data: {
        statusCode: response.statusCode ?? 200,
        headers: response.headers ?? {},
        trailers: response.trailers ?? {},
        duration: 1,
      },
      meta: { role: 'origin server' },
    },
  };
}

describe('rfc9110/sender-may-send-etag-in-trailer (test)', () => {
  it('hints when the live 2xx response sends ETag in its trailer section', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: { etag: '"v1"' },
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });

  it('hints when the live 2xx response sends ETag as both a header field and a trailer', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { etag: '"v1"' },
      trailers: { etag: '"v1"' },
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });

  it('stays silent when the live 2xx response sends ETag as a header field', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { etag: '"v1"' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('stays silent when the live 2xx response sends no ETag at all', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('stays silent when the response is not 2xx, even with an ETag trailer', async () => {
    const results = await runTest(
      {
        statusCode: 404,
        headers: {},
        trailers: { etag: '"v1"' },
        duration: 0,
      },
      404,
    );

    expect(results).toEqual([]);
  });
});

describe('rfc9110/sender-may-send-etag-in-trailer (analytics)', () => {
  it('hints when a 2xx response sends ETag in its trailer section', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: [transaction({ trailers: { etag: '"v1"' } })],
    });

    expect(results).toHaveLength(1);
  });

  it('hints when a 2xx response sends ETag as both a header field and a trailer', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: [
        transaction({
          headers: { etag: '"v1"' },
          trailers: { etag: '"v1"' },
        }),
      ],
    });

    expect(results).toHaveLength(1);
  });

  it('stays silent when a 2xx response sends ETag as a header field', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: [transaction({ headers: { etag: '"v1"' } })],
    });

    expect(results).toEqual([]);
  });

  it('stays silent when a 2xx response sends no ETag at all', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: [transaction({})],
    });

    expect(results).toEqual([]);
  });

  it('stays silent when a non-2xx response sends ETag in its trailer section', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: [
        transaction({ statusCode: 404, trailers: { etag: '"v1"' } }),
      ],
    });

    expect(results).toEqual([]);
  });
});
