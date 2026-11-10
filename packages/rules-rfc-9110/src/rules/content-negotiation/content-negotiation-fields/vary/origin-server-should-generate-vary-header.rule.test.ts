import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createParameter,
  createThymianFormatWithTransaction,
  exampleRequestSampler,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './origin-server-should-generate-vary-header.rule.js';

// The specification declares Accept-Language on a cacheable GET; the live
// request either sends it or does not.
function runTest(
  liveRequestHeaders: Record<string, string>,
  response: HttpResponse,
): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({
        method: 'get',
        path: '/rocket-types',
        headers: { 'accept-language': createParameter() },
      }),
      createHttpResponse({ statusCode: 200 }),
    ),
    sampleRequest: async (transaction) => ({
      ...(await exampleRequestSampler(transaction)),
      headers: liveRequestHeaders,
    }),
    runRequest: async () => response,
  });
}

const responseWithoutVary: HttpResponse = {
  statusCode: 200,
  headers: {},
  trailers: {},
  duration: 0,
};

describe('rfc9110/origin-server-should-generate-vary-header (test)', () => {
  it('reports a violation when the live request negotiated and the response omits Vary', async () => {
    const results = await runTest(
      { 'accept-language': 'de' },
      responseWithoutVary,
    );

    expect(results).toHaveLength(1);
  });

  it('reports no violation when the live response lists the negotiated header in Vary', async () => {
    const results = await runTest(
      { 'accept-language': 'de' },
      {
        statusCode: 200,
        headers: { vary: 'Accept-Language' },
        trailers: {},
        duration: 0,
      },
    );

    expect(results).toEqual([]);
  });

  it('stays silent when the live request carried no negotiation header', async () => {
    const results = await runTest({}, responseWithoutVary);

    expect(results).toEqual([]);
  });
});
