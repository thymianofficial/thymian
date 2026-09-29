import {
  createHttpTestContext,
  type HttpRequestTemplate,
  type HttpResponse,
  NoopLogger,
  type RuleFnResult,
  type TestContext,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { HttpTestApiContext } from '@thymian/plugin-http-tester';
import { describe, expect, it } from 'vitest';

import rule from './authentication-parameter-name-must-occur-once-per-challenge.rule.js';

async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({ method: 'get', path: '/rocket-types' }),
    createHttpResponse({ statusCode: 401 }),
  );

  const ctx = createHttpTestContext({
    format,
    logger: new NoopLogger(),
    locals: {},
    sampleRequest: async (transaction): Promise<HttpRequestTemplate> => ({
      method: transaction.thymianReq.method,
      origin: 'http://localhost:3000',
      path: transaction.thymianReq.path,
      headers: {},
      pathParameters: {},
      query: {},
      cookies: {},
      authorize: true,
    }),
    runRequest: async () => response,
    runHook: async (_name, hook) => ({ result: hook.value }) as never,
  });

  const context = new HttpTestApiContext('test-rule', ctx) as TestContext;

  if (!rule.testRule) {
    throw new Error('Expected the rule to define a test rule function.');
  }

  return rule.testRule(context, { mode: 'test' }, new NoopLogger());
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
