import {
  createHttpTestContext,
  type HttpRequestTemplate,
  type HttpResponse,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  type TestContext,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { createThymianFormatWithTransaction } from '@thymian/core-testing';
import { HttpTestApiContext } from '@thymian/plugin-http-tester';

/**
 * Runs a rule's `test` function through the real `HttpTestApiContext` against
 * one described transaction, answering every request with `live`.
 */
export async function runTestRule(
  rule: Rule,
  described: { req: ThymianHttpRequest; res: ThymianHttpResponse },
  live: HttpResponse,
): Promise<RuleFnResult[]> {
  const format = createThymianFormatWithTransaction(
    described.req,
    described.res,
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
    runRequest: async () => live,
    runHook: async (_name, hook) => ({ result: hook.value }) as never,
  });

  const context = new HttpTestApiContext('test-rule', ctx) as TestContext;

  if (!rule.testRule) {
    throw new Error('Expected the rule to define a test rule function.');
  }

  return rule.testRule(context, { mode: 'test' }, new NoopLogger());
}
