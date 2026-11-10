import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './server-must-send-upgrade-header-in-426-response.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 426 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/server-must-send-upgrade-header-in-426-response (test)', () => {
  it('reports no violation when the live 426 response carries Upgrade', async () => {
    const results = await runTest({
      statusCode: 426,
      headers: { upgrade: 'HTTP/2.0' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports no violation when the server answers with another status', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live 426 response omits Upgrade', async () => {
    const results = await runTest({
      statusCode: 426,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
