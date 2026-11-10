import type { HttpResponse, RuleFnResult } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { runInContext } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './authentication-parameter-name-must-occur-once-per-challenge.rule.js';

function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return runInContext('test', rule, {
    format: createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/rocket-types' }),
      createHttpResponse({ statusCode: 401 }),
    ),
    runRequest: async () => response,
  });
}

describe('rfc9110/authentication-parameter-name-must-occur-once-per-challenge (test)', () => {
  it('reports no violation when the live challenge repeats no parameter', async () => {
    const results = await runTest({
      statusCode: 401,
      headers: { 'www-authenticate': 'Basic realm="a", charset="UTF-8"' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live challenge repeats a parameter name', async () => {
    const results = await runTest({
      statusCode: 401,
      headers: { 'www-authenticate': 'Basic realm="a", realm="b"' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
