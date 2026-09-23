import { fileURLToPath } from 'node:url';

import {
  createHttpTestContext,
  type HttpResponse,
  httpTest,
  type HttpTestCase,
  type HttpTestContextLocals,
  type HttpTestPipeline,
  loadRules,
  NoopLogger,
  type TestContext,
  ThymianFormat,
} from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import rule from './server-must-send-www-authenticate-header-for-401-response.rule.js';

// DELETE /launches/{id} declaring both 401 and 403 — two transactions, one operation.
function createFormat(): ThymianFormat {
  const format = new ThymianFormat();
  const reqId = format.addRequest(
    createHttpRequest({ method: 'delete', path: '/launches/1' }),
  );
  format.addResponseToRequest(reqId, createHttpResponse({ statusCode: 401 }));
  format.addResponseToRequest(reqId, createHttpResponse({ statusCode: 403 }));

  return format;
}

async function runTest(response: HttpResponse): Promise<HttpTestCase[]> {
  const format = createFormat();
  const ctx = createHttpTestContext({
    format,
    logger: new NoopLogger(),
    locals: {},
    sampleRequest: async (transaction) => ({
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

  const cases: HttpTestCase[] = [];
  const testContext = {
    format,
    httpTest: async (pipeline: HttpTestPipeline<HttpTestContextLocals>) => {
      const result = await httpTest('test', pipeline)(ctx);
      cases.push(...result.cases);

      return [];
    },
  } as unknown as TestContext;

  if (!rule.testRule) {
    throw new Error('Expected the rule to override its test.');
  }

  await rule.testRule(testContext, { mode: 'test' }, new NoopLogger());

  return cases;
}

function unauthorized(headers: Record<string, string> = {}): HttpResponse {
  return { statusCode: 401, headers, trailers: {}, duration: 0 };
}

describe('rfc9110/server-must-send-www-authenticate-header-for-401-response (test)', () => {
  it('fails the declared 401 transaction when the challenge is missing, and tests only that one', async () => {
    const cases = await runTest(unauthorized());

    expect(cases.map((c) => c.status)).toEqual(['failed']);
  });

  it('passes when the 401 carries a challenge', async () => {
    const cases = await runTest(
      unauthorized({ 'www-authenticate': 'Bearer realm="launches"' }),
    );

    expect(cases.map((c) => c.status)).toEqual(['passed']);
  });

  it('skips when the server does not answer the credential-less request with 401', async () => {
    const cases = await runTest({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(cases.map((c) => c.status)).toEqual(['skipped']);
  });

  it('rejects the removed checkAllSecured option instead of silently ignoring it', async () => {
    const rulePath = fileURLToPath(
      new URL(
        './server-must-send-www-authenticate-header-for-401-response.rule.ts',
        import.meta.url,
      ),
    );

    await expect(
      loadRules(rulePath, () => true, {
        [rule.meta.name]: { options: { checkAllSecured: true } },
      }),
    ).rejects.toMatchObject({ name: 'InvalidRuleOptionError' });
  });
});
