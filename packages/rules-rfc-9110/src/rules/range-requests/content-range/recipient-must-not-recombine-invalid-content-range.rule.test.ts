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

import rule from './recipient-must-not-recombine-invalid-content-range.rule.js';

async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({ method: 'get', path: '/rocket-types' }),
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
