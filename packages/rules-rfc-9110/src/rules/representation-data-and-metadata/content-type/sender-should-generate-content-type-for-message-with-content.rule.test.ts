import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createObjectSchema,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './sender-should-generate-content-type-for-message-with-content.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 200, schema: createObjectSchema() }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/sender-should-generate-content-type-for-message-with-content (test)', () => {
  it('reports no violation when the live response carries a Content-Type header', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response has a body but no Content-Type header', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toBe(
      'The response contains content but no Content-Type header field.',
    );
  });
});
