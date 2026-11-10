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

import rule from './origin-server-should-send-response-without-content-coding.rule.js';

// The specification declares Accept-Encoding on the request but no
// Content-Encoding on the response: before ADR-0022 this pair was never sent.
// The live request excludes gzip and accepts br.
function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({
        method: 'get',
        path: '/rocket-types',
        headers: { 'accept-encoding': createParameter() },
      }),
      createHttpResponse({ statusCode: 200 }),
    ),
    sampleRequest: async (transaction) => ({
      ...(await exampleRequestSampler(transaction)),
      headers: { 'accept-encoding': 'gzip;q=0, br' },
    }),
    runRequest: async () => response,
  });
}

describe('rfc9110/origin-server-should-send-response-without-content-coding (test)', () => {
  it('reports no violation when the live response carries no Content-Encoding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports no violation when the live response uses an acceptable coding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-encoding': 'br' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response uses a coding the request excluded, though the specification declares no Content-Encoding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-encoding': 'gzip' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
