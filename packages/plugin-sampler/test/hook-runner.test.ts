import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterAll, describe, expect, it } from 'vitest';

import { HookRunner } from '../src/hooks/hook-runner.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(1);
const catalog = TransactionCatalog.fromThymianFormat(format);

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

function createRunner(hooksDir: string): HookRunner {
  return new HookRunner(
    hooksDir,
    async (): Promise<HttpResponse> => {
      throw new Error('runRequest must not be called in these tests');
    },
    createMockLogger(),
  );
}

async function writeHooks(files: Record<string, string>): Promise<string> {
  const root = await createTempDir('.tmp-sampler-runner-');
  roots.push(root);

  const hooksDir = join(root, '.thymian', 'sampler', 'hooks');
  await mkdir(hooksDir, { recursive: true });

  for (const [relative, content] of Object.entries(files)) {
    await writeFile(join(hooksDir, relative), content, 'utf-8');
  }

  return hooksDir;
}

function firstTransaction(
  from: ThymianFormat = format,
): ThymianHttpTransaction {
  const [transaction] = from.getThymianHttpTransactions();

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

function templateFor(source: ThymianHttpTransaction): HttpRequestTemplate {
  return {
    authorize: false,
    cookies: {},
    headers: {},
    method: source.thymianReq.method,
    origin: `${source.thymianReq.protocol}://${source.thymianReq.host}:${source.thymianReq.port}`,
    path: source.thymianReq.path,
    pathParameters: {},
    query: {},
  };
}

const requestTemplate = templateFor(transaction);

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

describe('HookRunner without a hooks directory', () => {
  const missingPath = join(
    process.cwd(),
    'this-directory-does-not-exist',
    'hooks',
  );

  it('initializes as a pass-through instead of staying uninitialized', async () => {
    const runner = createRunner(missingPath);

    await expect(runner.init(format, catalog)).resolves.toBeUndefined();
  });

  it('passes a request template through beforeEachRequest unchanged', async () => {
    const runner = createRunner(missingPath);
    await runner.init(format, catalog);

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
    await runner.init(format, catalog);

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
    await runner.init(format, catalog);

    const result = await runner.authorize({
      value: requestTemplate,
      ctx: transaction,
    });

    expect(result.result).toEqual(requestTemplate);
    expect(result.skip).toBeUndefined();
    expect(result.fail).toBeUndefined();
  });

  it('still refuses to run hooks before init', async () => {
    const runner = createRunner(missingPath);

    await expect(
      runner.beforeEachRequest({ value: requestTemplate, ctx: transaction }),
    ).rejects.toThrow(/before @thymian\/plugin-sampler is initialized/);
  });
});

describe('HookRunner.init rebinds on every format load (#614)', () => {
  const formatA = createThymianFormatWithTransactions([
    [createHttpRequest({ path: '/shared' }), createHttpResponse()],
  ]);
  const formatB = createThymianFormatWithTransactions([
    [createHttpRequest({ path: '/shared' }), createHttpResponse()],
    [createHttpRequest({ path: '/only-in-b' }), createHttpResponse()],
  ]);
  const catalogA = TransactionCatalog.fromThymianFormat(formatA);
  const catalogB = TransactionCatalog.fromThymianFormat(formatB);

  function onlyInB(): ThymianHttpTransaction {
    const found = formatB
      .getThymianHttpTransactions()
      .find((candidate) => candidate.thymianReq.path === '/only-in-b');

    if (!found) {
      throw new Error('fixture B must carry /only-in-b');
    }

    return found;
  }

  it('binds a global authorize to the second format, not the first', async () => {
    // A global `authorize` binds to every transaction in the *catalog*, so the
    // set of bound transactions is a direct read-out of which format the runner
    // last resolved against. With an init latch the second call is a no-op and
    // `/only-in-b` never gets a hook.
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);

    await runner.init(formatA, catalogA);
    await runner.init(formatB, catalogB);

    const target = onlyInB();
    const result = await runner.authorize({
      value: templateFor(target),
      ctx: target,
    });

    expect(result.result.path).toBe('/authorized');
  });

  it('leaves the runner uninitialized when a re-bind fails', async () => {
    // The hook resolves against A and dangles against B. `initialized` is set
    // only after the loader returns and the map is installed, so the failed
    // re-bind must not leave a runner marked initialized with a stale map.
    const hooksDir = await writeHooks({
      'gone.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('GET /shared -> 200 (application/json)', async (value) => ({`,
        `  ...value,`,
        `  path: '/hooked',`,
        `}));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);
    const emptyFormat = createThymianFormatWithTransactions([
      [createHttpRequest({ path: '/something-else' }), createHttpResponse()],
    ]);

    await runner.init(formatA, catalogA);

    const bound = await runner.beforeEachRequest({
      value: templateFor(firstTransaction(formatA)),
      ctx: firstTransaction(formatA),
    });

    expect(bound.result.path).toBe('/hooked');

    await expect(
      runner.init(
        emptyFormat,
        TransactionCatalog.fromThymianFormat(emptyFormat),
      ),
    ).rejects.toThrow(/sampler hook problem/);

    await expect(
      runner.beforeEachRequest({
        value: templateFor(firstTransaction(formatA)),
        ctx: firstTransaction(formatA),
      }),
    ).rejects.toThrow(/before @thymian\/plugin-sampler is initialized/);
  });

  it('throws a single aggregated HookResolutionError before any request', async () => {
    const hooksDir = await writeHooks({
      'one.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const a = beforeEach('GET /gone-one -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
      'two.ts': [
        `import { afterEach } from '@thymian/hooks';`,
        `export const b = afterEach('GET /gone-two -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);

    await expect(runner.init(formatA, catalogA)).rejects.toMatchObject({
      name: 'HookResolutionError',
    });

    await runner.init(formatA, catalogA).catch((error: Error) => {
      expect(error.message).toContain('one.ts');
      expect(error.message).toContain('two.ts');
    });
  });
});

describe('HookRunner with hooks', () => {
  it('composes beforeEach hooks in load order and binds afterEach separately', async () => {
    const hooksDir = await writeHooks({
      'a.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('GET /transaction-0 -> 200 (application/json)', async (value) => ({`,
        `  ...value,`,
        `  path: value.path + '/a',`,
        `}));`,
        ``,
      ].join('\n'),
      'b.ts': [
        `import { afterEach, beforeEach } from '@thymian/hooks';`,
        `export const before = beforeEach('GET /transaction-0 -> 200 (application/json)', async (value) => ({`,
        `  ...value,`,
        `  path: value.path + '/b',`,
        `}));`,
        `export const after = afterEach('GET /transaction-0 -> 200 (application/json)', async (value) => ({`,
        `  ...value,`,
        `  statusCode: 299,`,
        `}));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);
    await runner.init(format, catalog);

    const before = await runner.beforeEachRequest({
      value: requestTemplate,
      ctx: transaction,
    });

    expect(before.result.path).toBe(`${requestTemplate.path}/a/b`);

    const after = await runner.afterEachResponse({
      value: response,
      ctx: { requestTemplate, request, thymianTransaction: transaction },
    });

    expect(after.result.statusCode).toBe(299);
  });

  it('leaves an unhooked transaction a pass-through', async () => {
    const twoFormat = createThymianFormatWithTransactions(2);
    const twoCatalog = TransactionCatalog.fromThymianFormat(twoFormat);
    const hooksDir = await writeHooks({
      'a.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('GET /transaction-0 -> 200 (application/json)', async (value) => ({`,
        `  ...value,`,
        `  path: '/hooked',`,
        `}));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);
    await runner.init(twoFormat, twoCatalog);

    const unhooked = twoFormat
      .getThymianHttpTransactions()
      .find((candidate) => candidate.thymianReq.path === '/transaction-1');

    if (!unhooked) {
      throw new Error('fixture must carry /transaction-1');
    }

    const result = await runner.beforeEachRequest({
      value: templateFor(unhooked),
      ctx: unhooked,
    });

    expect(result.result.path).toBe('/transaction-1');
  });
});
