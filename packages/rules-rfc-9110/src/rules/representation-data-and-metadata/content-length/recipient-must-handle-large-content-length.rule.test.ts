import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './recipient-must-handle-large-content-length.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 200 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/recipient-must-handle-large-content-length (test)', () => {
  it('reports no violation when the live response carries a single well-formed Content-Length', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-length': '42' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports conflicting Content-Length values the specification never declared', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-length': '42, 43' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].violation?.message).toBe(
      'The response carries conflicting Content-Length values ("42", "43").',
    );
  });
});
