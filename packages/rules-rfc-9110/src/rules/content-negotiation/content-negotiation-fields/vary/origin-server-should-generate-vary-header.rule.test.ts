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

import rule from './origin-server-should-generate-vary-header.rule.js';

// The specification declares Accept-Language on a cacheable GET; the live
// request either sends it or does not.
async function runTest(
  liveRequestHeaders: Record<string, string>,
  response: HttpResponse,
): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    createHttpRequest({
      method: 'get',
      path: '/rocket-types',
      headers: { 'accept-language': createParameter() },
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
      headers: liveRequestHeaders,
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

const responseWithoutVary: HttpResponse = {
  statusCode: 200,
  headers: {},
  trailers: {},
  duration: 0,
};

describe('rfc9110/origin-server-should-generate-vary-header (test)', () => {
  it('reports a violation when the live request negotiated and the response omits Vary', async () => {
    const results = await runTest(
      { 'accept-language': 'de' },
      responseWithoutVary,
    );

    expect(results).toHaveLength(1);
  });

  it('reports no violation when the live response lists the negotiated header in Vary', async () => {
    const results = await runTest(
      { 'accept-language': 'de' },
      {
        statusCode: 200,
        headers: { vary: 'Accept-Language' },
        trailers: {},
        duration: 0,
      },
    );

    expect(results).toEqual([]);
  });

  it('stays silent when the live request carried no negotiation header', async () => {
    const results = await runTest({}, responseWithoutVary);

    expect(results).toEqual([]);
  });
});
