import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './sender-should-indicate-complete-length-for-byte-ranges.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 206 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/sender-should-indicate-complete-length-for-byte-ranges (test)', () => {
  it('reports no violation when the server answers the full representation with 200', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports no violation when the live 206 response indicates the complete length', async () => {
    const results = await runTest({
      statusCode: 206,
      headers: { 'content-range': 'bytes 0-1023/8192' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live 206 response omits Content-Range', async () => {
    const results = await runTest({
      statusCode: 206,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
