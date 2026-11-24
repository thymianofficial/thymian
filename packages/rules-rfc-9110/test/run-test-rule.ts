import {
  createHttpTestContext,
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type HttpTestCase,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  type TestContext,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { createThymianFormatWithTransaction } from '@thymian/core-testing';
import {
  HttpTestApiContext,
  type HttpTesterCallDiagnostics,
} from '@thymian/plugin-http-tester';

/**
 * Runs a rule's `test` function through the real `HttpTestApiContext` against
 * one described transaction, answering every request with `live` (or with what
 * `live` returns for it), and returns the test cases it ran next to its results,
 * with the cases in which the live re-check of `appliesTo` rejected pairs
 * (ADR-0030).
 */
export async function runTestRuleCases(
  rule: Rule,
  described: { req: ThymianHttpRequest; res: ThymianHttpResponse },
  live: HttpResponse | ((request: HttpRequest) => HttpResponse),
): Promise<{
  results: RuleFnResult[];
  cases: HttpTestCase[];
  rejectedCases: NonNullable<HttpTesterCallDiagnostics['rejectedCases']>;
}> {
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
    runRequest: async (request) =>
      typeof live === 'function' ? live(request) : live,
    runHook: async (_name, hook) => ({ result: hook.value }) as never,
  });

  const context = new HttpTestApiContext('test-rule', ctx);

  if (!rule.testRule) {
    throw new Error('Expected the rule to define a test rule function.');
  }

  const results = await rule.testRule(
    context as TestContext,
    { mode: 'test' },
    new NoopLogger(),
  );
  const { calls } = context.getRuleExecutionDiagnostics();
  const cases = calls.flatMap(({ testResult }) => testResult.cases);
  const rejectedCases = calls.flatMap(
    ({ rejectedCases = [] }) => rejectedCases,
  );

  return { results, cases, rejectedCases };
}

/** {@link runTestRuleCases}, returning only the rule's results. */
export async function runTestRule(
  rule: Rule,
  described: { req: ThymianHttpRequest; res: ThymianHttpResponse },
  live: HttpResponse | ((request: HttpRequest) => HttpResponse),
): Promise<RuleFnResult[]> {
  return (await runTestRuleCases(rule, described, live)).results;
}
