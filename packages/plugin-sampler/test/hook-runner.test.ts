import { join } from 'node:path';

import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  ThymianHttpTransaction,
} from '@thymian/core';
import {
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { HookRunner } from '../src/hooks/hook-runner.js';

const format = createThymianFormatWithTransactions(1);

function createRunner(path: string): HookRunner {
  return new HookRunner(
    path,
    async (): Promise<HttpResponse> => {
      throw new Error('runRequest must not be called in these tests');
    },
    createMockLogger(),
  );
}

function firstTransaction(): ThymianHttpTransaction {
  const [transaction] = format.getThymianHttpTransactions();

  if (!transaction) {
    throw new Error('fixture format must contain one transaction');
  }

  return transaction;
}

/**
 * All three hook entry points branch on the transaction their ctx carries —
 * `beforeEachRequest` and `authorize` on `ctx?.transactionId`, `afterEachResponse`
 * on `ctx.thymianTransaction` — and return early when it is absent. Handing them a
 * real transaction from the fixture format is what pushes them past that branch and
 * into the `this.hooks` lookup, so these cases demonstrate AC5's "empty hook map is
 * a pass-through" rather than the much weaker "no transaction ctx is a pass-through".
 *
 * Shapes mirror production (`packages/core/src/http-testing/operators/run-requests.operator.ts`):
 * `beforeRequest` and `authorize` receive `transaction.source`, a
 * `ThymianHttpTransaction`; `afterResponse` receives
 * `{ request, requestTemplate, thymianTransaction }`.
 */
const transaction = firstTransaction();

const requestTemplate: HttpRequestTemplate = {
  authorize: false,
  cookies: {},
  headers: {},
  method: transaction.thymianReq.method,
  origin: `${transaction.thymianReq.protocol}://${transaction.thymianReq.host}:${transaction.thymianReq.port}`,
  path: transaction.thymianReq.path,
  pathParameters: {},
  query: {},
};

const request: HttpRequest = {
  headers: {},
  method: requestTemplate.method,
  origin: requestTemplate.origin,
  path: requestTemplate.path,
};

const response: HttpResponse = {
  duration: 1,
  headers: {},
  statusCode: transaction.thymianRes.statusCode,
  trailers: {},
};

describe('HookRunner without a samples tree', () => {
  const missingPath = join(
    process.cwd(),
    'this-directory-does-not-exist',
    'samples',
  );

  it('initializes as a pass-through instead of staying uninitialized', async () => {
    const runner = createRunner(missingPath);

    await expect(runner.init(format)).resolves.toBeUndefined();
  });

  it('passes a request template through beforeEachRequest unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.beforeEachRequest({
      value: requestTemplate,
      ctx: transaction,
    });

    expect(result.result).toEqual(requestTemplate);
    expect(result.testResults).toEqual([]);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });

  it('passes a response through afterEachResponse unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.afterEachResponse({
      value: response,
      ctx: { requestTemplate, request, thymianTransaction: transaction },
    });

    expect(result.result).toEqual(response);
    expect(result.testResults).toEqual([]);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });

  it('passes a request template through authorize unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format);

    const result = await runner.authorize({
      value: requestTemplate,
      ctx: transaction,
    });

    expect(result.result).toEqual(requestTemplate);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });
});
