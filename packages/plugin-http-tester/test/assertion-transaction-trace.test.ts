import { strict as assert } from 'node:assert';

import {
  createHttpTestContext,
  expect as expectAssertion,
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  httpRule,
  type HttpTestContext,
  type HttpTestContextLocals,
  type HttpTestPipeline,
  type Logger,
  method,
  NoopLogger,
  singleTestCase,
  statusCode,
  type TestCaseExecution,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { describe, expect, it, vi } from 'vitest';

import { HttpTestApiContext } from '../src/http-test-api-context.js';
import { createRuns } from '../src/index.js';

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function mockContextReturning(
  format: ReturnType<typeof createThymianFormatWithTransaction>,
  response: HttpResponse,
): HttpTestContext {
  return createHttpTestContext({
    format,
    logger: new NoopLogger(),
    locals: {},
    sampleRequest: async (transaction): Promise<HttpRequestTemplate> => ({
      method: transaction.thymianReq.method,
      origin: 'https://api.example.com',
      path: transaction.thymianReq.path,
      headers: transaction.thymianReq.headers ?? {},
      pathParameters: {},
      query: {},
      authorize: true,
      cookies: {},
    }),
    runRequest: async (_req: HttpRequest): Promise<HttpResponse> => response,
    runHook: async (_hookName, hook) => ({ result: hook.value }),
  });
}

describe('assertion failure → transaction traceability', () => {
  it('traces a failed assertion in the report to its step transaction and HTTP detail', async () => {
    // A valid GET /users transaction (live response matches the sampled 200) is
    // then run through an assertion that (deliberately) expects a 500, so the
    // assertion fails on a real, captured transaction — exercising the full path.
    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/users' }),
      createHttpResponse({ statusCode: 200, headers: {} }),
    );

    const context = new HttpTestApiContext(
      'trace-test',
      mockContextReturning(format, {
        statusCode: 200,
        headers: {},
        duration: 0,
        trailers: {},
      }),
    );

    const ruleFnResult = await context.httpTest(
      singleTestCase()
        .forTransactionsWith(method('get'))
        .run()
        .expectForTransactions(statusCode(500))
        .done(),
    );

    const diagnostics = context.getRuleExecutionDiagnostics();
    expect(diagnostics).toBeDefined();

    const rule = httpRule('test/status-should-be-200')
      .severity('error')
      .type('test')
      .summary('Status should be 200')
      .rule(() => [])
      .done();

    const [run] = createRuns(
      'test-plugin',
      { [rule.meta.name]: { ruleFnResult, diagnostics } },
      [rule],
      format,
      makeLogger(),
    );

    const cases = (run?.executions ?? []) as TestCaseExecution[];
    const failedCase = cases.find((c) => c.status.kind === 'failed');
    expect(failedCase).toBeDefined();

    // Find the assertion-failure finding and the step that owns it.
    const owningStep = failedCase!.steps.find((step) =>
      step.findings.some((f) => f.kind === 'assertion-failure'),
    );
    expect(owningStep).toBeDefined();

    const assertionFailure = owningStep!.findings.find(
      (f) => f.kind === 'assertion-failure',
    );
    expect(assertionFailure).toBeDefined();

    // The finding links to a specific transaction on its step, and that index
    // resolves to a captured HTTP exchange with the response we can inspect.
    expect(assertionFailure!.transactionIndex).toBeDefined();
    expect(owningStep!.httpTransactions).toBeDefined();
    const tracedTransaction =
      owningStep!.httpTransactions![assertionFailure!.transactionIndex!];
    expect(tracedTransaction).toBeDefined();
    // The captured exchange the assertion ran against: the real 200 response
    // that failed the `expect status 500` assertion is fully traceable.
    expect(tracedTransaction!.response?.statusCode).toBe(200);
    expect(tracedTransaction!.request.method.toLowerCase()).toBe('get');
  });

  it('maps a failed top-level `expect` (no transaction) to a failed status, not skipped', async () => {
    // A top-level `expect` assertion failure produces an assertion-failure
    // result with NO transaction. It must still surface the case as `failed`
    // (with the assertion message as the reason) rather than silently being
    // reported as skipped and dropped from pass/fail counts.
    const format = createThymianFormatWithTransaction(
      createHttpRequest({ method: 'get', path: '/users' }),
      createHttpResponse({ statusCode: 200, headers: {} }),
    );

    const context = new HttpTestApiContext(
      'top-level-expect-test',
      mockContextReturning(format, {
        statusCode: 200,
        headers: {},
        duration: 0,
        trailers: {},
      }),
    );

    const base = singleTestCase()
      .forTransactionsWith(method('get'))
      .run()
      .done();
    const pipeline: HttpTestPipeline<HttpTestContextLocals> = (transactions) =>
      base(transactions).pipe(
        expectAssertion(() => {
          assert.equal('actual', 'expected', 'top-level assertion failed');
        }),
      );

    const ruleFnResult = await context.httpTest(pipeline);
    const diagnostics = context.getRuleExecutionDiagnostics();

    const rule = httpRule('test/top-level-expect')
      .severity('error')
      .type('test')
      .summary('Top-level expect')
      .rule(() => [])
      .done();

    const [run] = createRuns(
      'test-plugin',
      { [rule.meta.name]: { ruleFnResult, diagnostics } },
      [rule],
      format,
      makeLogger(),
    );

    const cases = (run?.executions ?? []) as TestCaseExecution[];
    expect(cases.filter((c) => c.status.kind === 'skipped')).toHaveLength(0);
    const failedCase = cases.find((c) => c.status.kind === 'failed');
    expect(failedCase).toBeDefined();
    expect(failedCase!.status.kind).toBe('failed');
  });
});
