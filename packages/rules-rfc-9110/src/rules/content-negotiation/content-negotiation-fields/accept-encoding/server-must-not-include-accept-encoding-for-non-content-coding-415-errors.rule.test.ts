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

import rule from './server-must-not-include-accept-encoding-for-non-content-coding-415-errors.rule.js';

// The specification describes a 415 without declaring an Accept-Encoding
// response header: before ADR-0022 this pair was never sent.
async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({ method: 'post', path: '/rocket-types' }),
    createHttpResponse({ statusCode: 415 }),
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
