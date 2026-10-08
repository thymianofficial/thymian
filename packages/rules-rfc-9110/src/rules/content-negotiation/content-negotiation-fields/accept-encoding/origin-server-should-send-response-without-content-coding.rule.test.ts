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
  createParameter,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { HttpTestApiContext } from '@thymian/plugin-http-tester';
import { describe, expect, it } from 'vitest';

import rule from './origin-server-should-send-response-without-content-coding.rule.js';

// The specification declares Accept-Encoding on the request but no
// Content-Encoding on the response: before ADR-0022 this pair was never sent.
async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({
      method: 'get',
      path: '/rocket-types',
      headers: { 'accept-encoding': createParameter() },
    }),
    createHttpResponse({ statusCode: 200 }),
  );

  const ctx = createHttpTestContext({
    format,
    logger: new NoopLogger(),
    locals: {},
    sampleRequest: async (transaction): Promise<HttpRequestTemplate> => ({
      method: transaction.thymianReq.method,
      origin: 'http://localhost:3000',
      path: transaction.thymianReq.path,
      headers: { 'accept-encoding': 'gzip;q=0, br' },
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

describe('rfc9110/origin-server-should-send-response-without-content-coding (test)', () => {
  it('reports no violation when the live response carries no Content-Encoding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports no violation when the live response uses an acceptable coding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-encoding': 'br' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response uses a coding the request excluded, though the specification declares no Content-Encoding', async () => {
    const results = await runTest({
      statusCode: 200,
      headers: { 'content-encoding': 'gzip' },
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
