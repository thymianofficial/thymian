import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './realm-parameter-must-use-quoted-string-syntax.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 401 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/realm-parameter-must-use-quoted-string-syntax (test)', () => {
  it('reports no violation when the live challenge quotes its realm', async () => {
    const results = await runTest({
      statusCode: 401,
      headers: { 'www-authenticate': 'Basic realm="thymian"' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live challenge sends its realm as a token', async () => {
    const results = await runTest({
      statusCode: 401,
      headers: { 'www-authenticate': 'Digest realm=thymian' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
