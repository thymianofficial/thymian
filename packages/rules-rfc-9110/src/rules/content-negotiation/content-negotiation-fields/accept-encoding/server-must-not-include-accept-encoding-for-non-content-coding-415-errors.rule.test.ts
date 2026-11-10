import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './server-must-not-include-accept-encoding-for-non-content-coding-415-errors.rule.js';

// The specification describes a 415 without declaring an Accept-Encoding
// response header: before ADR-0022 this pair was never sent.
function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'post', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 415 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/server-must-not-include-accept-encoding-for-non-content-coding-415-errors (test)', () => {
  it('reports no violation when the live 415 response omits Accept-Encoding', async () => {
    const results = await runTest({
      statusCode: 415,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live 415 response includes Accept-Encoding, though the specification declares none', async () => {
    const results = await runTest({
      statusCode: 415,
      headers: { 'accept-encoding': 'gzip' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
