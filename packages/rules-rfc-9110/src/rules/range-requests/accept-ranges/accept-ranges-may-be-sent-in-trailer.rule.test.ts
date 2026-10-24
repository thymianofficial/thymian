import type { CapturedTransaction } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { runAnalyticsRule } from '../../../../test/run-analytics-rule.js';
import rule from './accept-ranges-may-be-sent-in-trailer.rule.js';

function transaction(response: {
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
}): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/downloads/rocket-manual.pdf',
        headers: {},
      },
      meta: { role: 'user-agent' },
    },
    response: {
      data: {
        statusCode: 200,
        headers: response.headers ?? {},
        trailers: response.trailers ?? {},
        duration: 1,
      },
      meta: { role: 'origin server' },
    },
  };
}

describe('rfc9110/accept-ranges-may-be-sent-in-trailer (analytics)', () => {
  it('hints when the response sends Accept-Ranges in its trailer section', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({ trailers: { 'accept-ranges': 'bytes' } }),
    ]);

    expect(results).toHaveLength(1);
  });

  it('hints when the response sends Accept-Ranges as both a header field and a trailer', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({
        headers: { 'accept-ranges': 'bytes' },
        trailers: { 'accept-ranges': 'bytes' },
      }),
    ]);

    expect(results).toHaveLength(1);
  });

  it('stays silent when the response sends Accept-Ranges as a header field', async () => {
    const results = await runAnalyticsRule(rule, [
      transaction({ headers: { 'accept-ranges': 'bytes' } }),
    ]);

    expect(results).toEqual([]);
  });

  it('stays silent when the response sends no Accept-Ranges at all', async () => {
    const results = await runAnalyticsRule(rule, [transaction({})]);

    expect(results).toEqual([]);
  });
});
