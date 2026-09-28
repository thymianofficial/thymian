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
  createObjectSchema,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { HttpTestApiContext } from '@thymian/plugin-http-tester';
import { describe, expect, it } from 'vitest';

import rule from './sender-should-generate-content-type-for-message-with-content.rule.js';

async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({ method: 'get', path: '/rocket-types' }),
    createHttpResponse({ statusCode: 200, schema: createObjectSchema() }),
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
    expect(results[0].violation?.message).toBe(
      'The response contains content but no Content-Type header field.',
    );
  });
});
