import type { CapturedTransaction } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runAnalyticsRule } from '../../../../../test/run-analytics-rule.js';
import { runTestRule } from '../../../../../test/run-test-rule.js';
import rule from './sender-may-send-etag-in-trailer.rule.js';

const described = {
  req: createHttpRequest({ method: 'get', path: '/rocket-types' }),
  res: createHttpResponse({ statusCode: 200 }),
};

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
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: {},
      trailers: { etag: '"v1"' },
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });

  it('hints when the live 2xx response sends ETag as both a header field and a trailer', async () => {
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: { etag: '"v1"' },
      trailers: { etag: '"v1"' },
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });

  it('stays silent when the live 2xx response sends ETag as a header field', async () => {
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: { etag: '"v1"' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('stays silent when the live 2xx response sends no ETag at all', async () => {
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('stays silent when the response is not 2xx, even with an ETag trailer', async () => {
    const results = await runTestRule(
      rule,
      {
        req: described.req,
        res: createHttpResponse({ statusCode: 404 }),
      },
      {
        statusCode: 404,
        headers: {},
        trailers: { etag: '"v1"' },
        duration: 0,
      },
    );

    expect(results).toEqual([]);
  });
});

describe('rfc9110/sender-may-send-etag-in-trailer (analytics)', () => {
  it('hints when a 2xx response sends ETag in its trailer section', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({ trailers: { etag: '"v1"' } }),
    ]);

    expect(results).toHaveLength(1);
  });

  it('hints when a 2xx response sends ETag as both a header field and a trailer', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({
        headers: { etag: '"v1"' },
        trailers: { etag: '"v1"' },
      }),
    ]);

    expect(results).toHaveLength(1);
  });

  it('stays silent when a 2xx response sends ETag as a header field', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({ headers: { etag: '"v1"' } }),
    ]);

    expect(results).toEqual([]);
  });

  it('stays silent when a 2xx response sends no ETag at all', async () => {
    const results = await runAnalyticsRule(rule, [transaction({})]);

    expect(results).toEqual([]);
  });

  it('stays silent when a non-2xx response sends ETag in its trailer section', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({ statusCode: 404, trailers: { etag: '"v1"' } }),
    ]);

    expect(results).toEqual([]);
  });
});
