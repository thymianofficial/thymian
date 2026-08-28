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
import { LoadGeneration } from '../src/load-generation.js';
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

  // All three entry points kept their `initialized` guard through the #614
  // rewrite, but only `beforeEachRequest` was pinned — the other two were one
  // "simplification" away from silently answering before the hook map exists.
  it('still refuses to run afterEachResponse before init', async () => {
    const runner = createRunner(missingPath);

    await expect(
      runner.afterEachResponse({
        value: response,
        ctx: { requestTemplate, request, thymianTransaction: transaction },
      }),
    ).rejects.toThrow(/before @thymian\/plugin-sampler is initialized/);
  });

  it('still refuses to run authorize before init', async () => {
    const runner = createRunner(missingPath);

    await expect(
      runner.authorize({ value: requestTemplate, ctx: transaction }),
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

  it('lets the load that started last win when two overlap', async () => {
    // `init` writes `format` and `resolveTransactionId` **synchronously**, then
    // awaits the loader. Two `core.format` loads therefore both write their own
    // values before either finishes, and whichever settles last installs its
    // hook map over what the other left. Measured without the generation
    // counter: `initialized: true`, `format` = B, `resolveTransactionId` built
    // from B's catalog, and `hooks` bound to a transaction that exists only in
    // A — after `init(B)` had already failed.
    //
    // `Thymian.loadFormat` is a plain public method with no serialisation, and a
    // long-lived `core.workflow.test`/WS process is exactly where #614 says to
    // expect repeated loads.
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);

    const [first, second] = await Promise.allSettled([
      runner.init(formatA, catalogA),
      runner.init(formatB, catalogB),
    ]);

    // The superseded load reports that it was discarded rather than resolving
    // as if it had bound something. Resolving quietly let `core.format` reply
    // *success* over a runner that then refused every request.
    expect(first?.status).toBe('rejected');
    expect(
      first?.status === 'rejected' ? (first.reason as Error).name : undefined,
    ).toBe('HookRunnerSuperseded');
    expect(second?.status).toBe('fulfilled');

    // Bound against B, the load that started last, for a transaction that
    // exists only in B.
    const target = onlyInB();
    const result = await runner.authorize({
      value: templateFor(target),
      ctx: target,
    });

    expect(result.result.path).toBe('/authorized');
  });

  it('does not install a load the caller invalidated while it was running', async () => {
    // `init` writes its state, then awaits the loader. A `core.format` handler
    // that starts a *new* load — which bumps the shared `LoadGeneration`
    // token, exactly as `index.ts` does at the top of every load, before
    // calling `invalidate()` for the immediate state-clear — must not have its
    // decision overwritten when the older load finally settles. Without the
    // shared token the stale load installed its map and set
    // `initialized: true` over a runner the caller had just dropped.
    //
    // Constructed with an explicit `LoadGeneration` (rather than through
    // `createRunner`'s default-per-instance one) because superseding an
    // in-flight token from outside `init` is exactly what `index.ts` needs
    // this class shared for — `invalidate()` alone no longer bumps anything.
    const hooksDir = await writeHooks({
      'slow.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `await new Promise((resolve) => setTimeout(resolve, 80));`,
        `export const everywhere = authorize(async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const generation = new LoadGeneration();
    const runner = new HookRunner(
      hooksDir,
      async (): Promise<HttpResponse> => {
        throw new Error('runRequest must not be called in these tests');
      },
      createMockLogger(),
      generation,
    );
    const inFlight = runner.init(formatA, catalogA, generation.start());

    // While the loader is still reading, a new load starts and the caller
    // drops everything — the same two calls `index.ts` makes together at the
    // top of every `core.format` handler invocation.
    generation.start();
    runner.invalidate();

    // The discarded load says so. It used to resolve normally, so `core.format`
    // replied success over a permanently dead runner with nothing in the log.
    await expect(inFlight).rejects.toMatchObject({
      name: 'HookRunnerSuperseded',
    });

    await expect(
      runner.authorize({
        value: templateFor(firstTransaction(formatA)),
        ctx: firstTransaction(formatA),
      }),
    ).rejects.toMatchObject({ name: 'HookRunnerNotInitialized' });
  });

  it('leaves the runner uninitialized when a re-bind fails', async () => {
    // The hook resolves against A and dangles against B. `initialized` is set
    // only after the loader returns and the map is installed, so the failed
    // re-bind must not leave a runner marked initialized with a stale map.
    //
    // `invalidate()` is called between the two loads, mirroring `index.ts`
    // (which always invalidates before `init`, not `init` invalidating
    // itself — the duplication that let a stale load's own internal reset
    // race a newer load's).
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

    runner.invalidate();

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

    // `rejects`, not a bare `.catch`: with the assertions inside a callback the
    // test stayed green the moment `init` stopped rejecting — the callback was
    // simply never invoked, and the aggregated multi-file message this case
    // exists to pin went unasserted.
    await expect(runner.init(formatA, catalogA)).rejects.toThrow(/one\.ts/);
    await expect(runner.init(formatA, catalogA)).rejects.toThrow(/two\.ts/);
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

describe('what HookRunner.init reports to the log', () => {
  it('counts hooks, not the transactions a global authorize reaches', async () => {
    const twoFormat = createThymianFormatWithTransactions(2);
    const twoCatalog = TransactionCatalog.fromThymianFormat(twoFormat);
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const messages: string[] = [];
    const runner = new HookRunner(
      hooksDir,
      async (): Promise<HttpResponse> => {
        throw new Error('runRequest must not be called in these tests');
      },
      createMockLogger({
        debug: (message: string) => {
          messages.push(message);
        },
      }),
    );

    await runner.init(twoFormat, twoCatalog);

    // A global `authorize` binds every transaction in the catalog, so the map's
    // size is the catalog's size. Logging that as a binding count read as "2
    // hooks loaded" for one hook — and as "240 hooks" on a real API.
    expect(
      messages.some((message) =>
        /Loaded 1 hook\(s\) across 2 transaction\(s\) from 1 hook file\(s\)\./.test(
          message,
        ),
      ),
      messages.join('\n'),
    ).toBe(true);
  });

  it('renders debug diagnostics through the shared formatter', async () => {
    // The debug line was the one rendering path the line sanitizer did not
    // cover, so a hook file whose *name* carried an ESC — legal on Linux and
    // macOS — rewrote the terminal on every debug run. Going through
    // `formatDiagnostic` also puts `kind` and `anchor` into the line, which the
    // hand-assembled version dropped.
    const oneFormat = createThymianFormatWithTransactions(1);
    const oneCatalog = TransactionCatalog.fromThymianFormat(oneFormat);
    const hooksDir = await writeHooks({
      'a.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const messages: string[] = [];
    const runner = new HookRunner(
      hooksDir,
      async (): Promise<HttpResponse> => {
        throw new Error('runRequest must not be called in these tests');
      },
      createMockLogger({
        debug: (message: string) => {
          messages.push(message);
        },
      }),
    );

    await runner.init(oneFormat, oneCatalog);

    const said = messages.join('\n');

    // `kind`, `anchor` and `exportName` only reach the line through
    // `formatDiagnostic`.
    expect(said, said).toContain('authorize');
    expect(said, said).toContain('global');
    expect(said, said).toContain('everywhere');
  });
});

describe('HookRunner — the pre-init throw window (round 4)', () => {
  it('drops the previous format`s map when invalidated', async () => {
    // AC 11 puts the reset at the top of `init`, which is right but not
    // sufficient: `core.format` runs two steps *before* `init` is reached —
    // `TransactionCatalog.fromThymianFormat`, which throws by design on a
    // cross-source selector collision, and `readSamplesFromDirIfUsable`, which
    // re-raises a refused path traversal. If either throws, `init` is never
    // called and the runner keeps `initialized: true` bound to the map built for
    // the format *before* the one that just failed to load.
    //
    // `invalidate()` is the seam the caller uses to close that window, and this
    // pins its contract: after a successful init, invalidating makes every entry
    // point refuse rather than run the stale bindings.
    // A global `authorize` binds every transaction in the catalog, so one hook
    // is enough to make "the map is populated" observable.
    const hooksDir = await writeHooks({
      'a.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
    });

    const runner = createRunner(hooksDir);

    await runner.init(format, catalog);

    const bound = await runner.authorize({
      value: requestTemplate,
      ctx: transaction,
    });

    expect(bound.result.path).toBe('/authorized');

    runner.invalidate();

    await expect(
      runner.beforeEachRequest({ value: requestTemplate, ctx: transaction }),
    ).rejects.toMatchObject({ name: 'HookRunnerNotInitialized' });
    await expect(
      runner.authorize({ value: requestTemplate, ctx: transaction }),
    ).rejects.toMatchObject({ name: 'HookRunnerNotInitialized' });
  });

  it('is idempotent, so a caller may invalidate on every load', async () => {
    const hooksDir = await writeHooks({});
    const runner = createRunner(hooksDir);

    runner.invalidate();
    runner.invalidate();

    await expect(
      runner.beforeEachRequest({ value: requestTemplate, ctx: transaction }),
    ).rejects.toMatchObject({ name: 'HookRunnerNotInitialized' });

    // And a normal init after it still works: invalidation is not a latch.
    await expect(runner.init(format, catalog)).resolves.toBeUndefined();
  });
});
