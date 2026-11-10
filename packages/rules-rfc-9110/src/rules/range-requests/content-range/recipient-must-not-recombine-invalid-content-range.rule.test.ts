import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './recipient-must-not-recombine-invalid-content-range.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 200 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/recipient-must-not-recombine-invalid-content-range (test)', () => {
  it('reports no violation when the live response carries no Content-Range', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports no violation when the live Content-Range is valid', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-range': 'bytes 0-1023/8192' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation for a live Content-Range the specification does not declare', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-range': 'bytes 1023-0/8192' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
