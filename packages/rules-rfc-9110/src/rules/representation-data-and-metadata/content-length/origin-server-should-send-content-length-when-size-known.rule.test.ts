import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createObjectSchema,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './origin-server-should-send-content-length-when-size-known.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 200, schema: createObjectSchema() }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/origin-server-should-send-content-length-when-size-known (test)', () => {
  it('reports no violation when the live response carries a Content-Length header', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-length': '2' },
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response has a body with neither Content-Length nor Transfer-Encoding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toBe(
      'The response carries content with no Transfer-Encoding and no Content-Length header.',
    );
  });
});
