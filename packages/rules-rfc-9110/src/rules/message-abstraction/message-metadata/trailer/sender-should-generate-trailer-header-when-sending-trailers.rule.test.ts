import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './sender-should-generate-trailer-header-when-sending-trailers.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 200 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/sender-should-generate-trailer-header-when-sending-trailers (test)', () => {
  it('reports no violation when the live response announces its trailers in a Trailer header', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { trailer: 'server-timing' },
      trailers: { 'server-timing': 'total;dur=12' },
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response sends trailers without a Trailer header', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: { 'server-timing': 'total;dur=12' },
      duration: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].violation?.message).toBe(
      'Response contains trailer fields (server-timing) but no Trailer header field was sent',
    );
  });
});
