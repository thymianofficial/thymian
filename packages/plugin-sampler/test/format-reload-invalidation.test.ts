import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type HttpRequestTemplate,
  ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { samplePlugin } from '../src/index.js';
import { samplesTreeFromThymianHttpTransaction } from '../src/samples-structure/samples-from-transactions.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

/**
 * Lets one test gate exactly one call to `readSamplesFromDirIfUsable` behind
 * a promise it controls, and leaves every other call — in this test file and
 * within the same test, once consumed — running at full speed.
 *
 * `readSamplesFromDirIfUsable` is the async step `index.ts` runs *ahead of*
 * both `requestSampler.init` and `hookRunner.init`, on every `core.format`
 * load. It is also the step whose real-world slowness (a large v1 tree, a
 * network filesystem) is what let an older load's write land after a newer
 * load had already finished and installed its own — the defect this file's
 * next `describe` block reproduces.
 *
 * `blockNext.entered` resolves the instant the mocked call is reached and
 * gated — not after some guessed delay. A `setTimeout` here would make the
 * whole point of this fixture, reproducing the race deterministically, false
 * under load: a fixed wall-clock gap can fail to produce the interleaving at
 * all, and the test would then pass **without exercising the race**, which
 * is worse than not having it — a green run stops meaning anything was
 * checked. Awaiting `entered` blocks the test's own continuation on the
 * mocked call's actual progress instead, however many microtask hops that
 * takes.
 */
function gatedRead(): {
  entered: Promise<void>;
  release: () => void;
} {
  let markEntered!: () => void;
  let release!: () => void;

  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  readControl.blockNext = async () => {
    markEntered();
    await held;
  };

  return { entered, release };
}

const readControl: { blockNext: (() => Promise<void>) | undefined } = {
  blockNext: undefined,
};

vi.mock(
  '../src/samples-structure/read-samples-from-dir.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../src/samples-structure/read-samples-from-dir.js')
      >();

    return {
      ...actual,
      readSamplesFromDirIfUsable: async (
        ...args: Parameters<typeof actual.readSamplesFromDirIfUsable>
      ) => {
        const gate = readControl.blockNext;

        readControl.blockNext = undefined;

        if (gate) {
          await gate();
        }

        return actual.readSamplesFromDirIfUsable(...args);
      },
    };
  },
);

/**
 * The window between the `core.format` handler's entry and `hookRunner.init`.
 *
 * AC 11 puts `initialized = false` at the top of `HookRunner.init`, which is
 * right but not sufficient: two steps run *before* `init` is reached, and both
 * can throw by design — `TransactionCatalog.fromThymianFormat` on a cross-source
 * selector collision, and `readSamplesFromDirIfUsable` on a refused path
 * traversal (the one read it deliberately does **not** degrade; see AC 9). If
 * either throws, `init` is never called and the runner keeps `initialized: true`
 * bound to the map built for the format *before* the one that just failed to
 * load — exactly the stale binding AC 11 and #614 exist to prevent, in the
 * long-lived `core.workflow.test` process AC 11's own rationale cites.
 *
 * A unit test on `HookRunner.invalidate()` cannot see this: it pins the method,
 * not that the `core.format` handler calls it. (Measured — deleting the call
 * from `index.ts` left the whole suite green until this file existed.) So this
 * one drives the real plugin through two `core.format` loads.
 */
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

const format = createThymianFormatWithTransactions(1);

function firstTransaction(): ThymianHttpTransaction {
  const [transaction] = format.getThymianHttpTransactions();

  if (!transaction) {
    throw new Error('fixture format must contain one transaction');
  }

  return transaction;
}

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

/**
 * A readable v1 samples tree.
 *
 * The transaction here is the fixture `samples-tree-guard.test.ts` uses, not the
 * one in the loaded format: `readSamplesFromDirIfUsable` reads the tree on disk
 * and never correlates it with the format. Written **before** the first load so
 * that `samples` is genuinely populated — without that, clearing it on a failed
 * reload is unobservable and the assertion below is vacuous (measured: the
 * mutation that deletes `samples = undefined` survived until this tree existed).
 */
async function writeValidSamplesTree(cwd: string): Promise<void> {
  const samplesDir = join(cwd, '.thymian', 'samples');

  await writeSamplesToDir(
    samplesTreeFromThymianHttpTransaction(
      {
        authorize: false,
        cookies: {},
        headers: {},
        method: 'get',
        origin: 'http://localhost:8080',
        path: '/status',
        pathParameters: {},
        query: {},
      },
      {
        thymianReq: {
          type: 'http-request',
          host: 'localhost',
          port: 8080,
          protocol: 'http',
          path: '/status',
          method: 'get',
          headers: {},
          queryParameters: {},
          cookies: {},
          pathParameters: {},
          mediaType: '',
          label: '',
          sourceName: 'test',
        },
        thymianReqId: '',
        thymianRes: {
          type: 'http-response',
          headers: {},
          mediaType: '',
          statusCode: 200,
          label: '',
          sourceName: 'test',
        },
        thymianResId: '',
        transaction: {
          type: 'http-transaction',
          label: '',
          sourceName: 'test',
        },
        transactionId: 'abc123',
      },
      samplesDir,
    ),
    {},
    { path: samplesDir },
  );
}

/** Makes that tree's one request sample escape its base directory. */
async function poisonSamplesTree(cwd: string): Promise<void> {
  const samplesDir = join(cwd, '.thymian', 'samples');
  const requestsDir = join(
    samplesDir,
    'test',
    'localhost',
    '8080',
    'status',
    '@GET',
    '200',
    'requests',
  );
  const [sampleFile] = (await readdir(requestsDir)).filter((name) =>
    name.endsWith('request.json'),
  );

  if (!sampleFile) {
    throw new Error('fixture tree must contain one request sample');
  }

  const samplePath = join(requestsDir, sampleFile);
  const sample = JSON.parse(await readFile(samplePath, 'utf-8')) as {
    headers: Record<string, unknown>;
  };

  sample.headers['x-escape'] = { $file: '../../../../../../../escape.txt' };
  await writeFile(samplePath, JSON.stringify(sample), 'utf-8');
}

async function bootPlugin(cwd: string): Promise<ThymianEmitter> {
  const emitter = new ThymianEmitter(
    createMockLogger(),
    ThymianEmitter.emptyEmitterState(),
  );

  await samplePlugin.plugin(emitter, createMockLogger(), {
    cwd,
  } as Parameters<typeof samplePlugin.plugin>[2]);

  return emitter;
}

describe('core.format reload after a throw (round 4)', () => {
  it('does not keep the previous format`s hooks when the reload throws', async () => {
    const cwd = await createTempDir('.tmp-sampler-reload-');
    roots.push(cwd);

    const hooksDir = join(cwd, '.thymian', 'sampler', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, 'auth.ts'),
      [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    await writeValidSamplesTree(cwd);

    const emitter = await bootPlugin(cwd);
    const source = firstTransaction();

    // First load: clean. The global `authorize` binds every transaction, so one
    // hook makes "the map is populated" directly observable.
    await emitter.emitAction('core.format', format.export(), {
      strategy: 'first',
    });

    const bound = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(source), ctx: source },
      { strategy: 'first' },
    );

    expect(bound.result.path).toBe('/authorized');

    // The tree loaded, so this action does not raise `SamplesNotLoadedError`.
    await expect(
      emitter.emitAction(
        'sampler.path-from-transaction',
        { transactionId: 'abc123' },
        { strategy: 'first' },
      ),
    ).resolves.toBeDefined();

    // Now poison the tree. `PathTraversalError` is the one read the
    // `core.format` path deliberately keeps hard (AC 9), and it is raised
    // *before* `hookRunner.init` is reached.
    await poisonSamplesTree(cwd);

    await expect(
      emitter.emitAction('core.format', format.export(), { strategy: 'first' }),
    ).rejects.toThrow(/outside of the base directory/);

    // The reload failed, so nothing may still be bound from before it.
    await expect(
      emitter.emitAction(
        'http-testing.authorize',
        { value: templateFor(source), ctx: source },
        { strategy: 'first' },
      ),
    ).rejects.toMatchObject({ name: 'HookRunnerNotInitialized' });

    // Same window, same rule, for the tree the failed load did not replace: the
    // samples that were readable a moment ago must not survive a load that
    // refused to read them.
    await expect(
      emitter.emitAction(
        'sampler.path-from-transaction',
        { transactionId: 'abc123' },
        { strategy: 'first' },
      ),
    ).rejects.toMatchObject({ name: 'SamplesNotLoadedError' });

    // And the third piece of cross-load state, one object over. The sample
    // projection is rebuilt by `requestSampler.init`, which the failed reload
    // never reached, so without its own invalidation it kept answering from the
    // format that is no longer loaded. `format` is assigned only after the load
    // succeeds, so the guard in front of this action is the one that fires —
    // rather than falling through to the "unreachable by construction"
    // projection error behind it.
    await expect(
      emitter.emitAction(
        'core.request.sample',
        { transaction: source },
        { strategy: 'first' },
      ),
    ).rejects.toMatchObject({ name: 'FormatNotLoadedError' });
  });
});

describe('core.format reload — the generation anchor must be taken once, per event (round 8)', () => {
  it("does not let an older load's slow pre-init read reinstate a stale format after a newer load already finished", async () => {
    // `requestSampler.init` and `hookRunner.init` each used to keep their own
    // counter, bumped inside their own `init`, and re-derived only *after*
    // this handler's samples-tree read had already resolved. That answers
    // "did something interrupt *my* own await", not "is this still the
    // newest `core.format` event" — and the two diverge exactly here: this
    // read runs ahead of both components, on every load, so a slow read for
    // an *older* event lets a *newer* event's entire round trip — its own
    // read, its own `requestSampler.init`, its own `hookRunner.init` — finish
    // first. When the older event's read finally resolves, its own
    // `invalidate()` + fresh capture (the old design) saw nothing else
    // in-flight and "won" anyway, reinstating a format nobody asked for any
    // more. `readControl` reproduces exactly that shape, deterministically.
    const cwd = await createTempDir('.tmp-sampler-anchor-');
    roots.push(cwd);

    const hooksDir = join(cwd, '.thymian', 'sampler', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, 'auth.ts'),
      [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    const olderFormat = createThymianFormatWithTransactions([
      [createHttpRequest({ path: '/only-in-older' }), createHttpResponse()],
    ]);
    const newerFormat = createThymianFormatWithTransactions([
      [createHttpRequest({ path: '/only-in-newer' }), createHttpResponse()],
    ]);

    function firstTxOf(source: typeof olderFormat): ThymianHttpTransaction {
      const [transaction] = source.getThymianHttpTransactions();

      if (!transaction) {
        throw new Error('fixture format must contain one transaction');
      }

      return transaction;
    }

    const olderTransaction = firstTxOf(olderFormat);
    const newerTransaction = firstTxOf(newerFormat);

    const emitter = await bootPlugin(cwd);

    const { entered, release } = gatedRead();

    const olderLoad = emitter.emitAction('core.format', olderFormat.export(), {
      strategy: 'first',
    });

    // Deterministic, not a guessed delay: resolves the instant the older
    // load's handler has actually reached the gated read and is suspended
    // there — see `gatedRead`'s docblock for why a `setTimeout` here would
    // make this reproduction unreliable exactly when it matters most.
    await entered;

    // `readControl.blockNext` was consumed by the older call, so the newer
    // load's own read — and everything after it, including both
    // `requestSampler.init` and `hookRunner.init` — runs unobstructed and
    // finishes completely before the older load's read is ever released.
    await emitter.emitAction('core.format', newerFormat.export(), {
      strategy: 'first',
    });

    const boundToNewerBeforeRelease = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(newerTransaction), ctx: newerTransaction },
      { strategy: 'first' },
    );

    expect(boundToNewerBeforeRelease.result.path).toBe('/authorized');

    // Now let the older load's read resolve. Its own `requestSampler.init`
    // and `hookRunner.init` run from here — after the newer load has already
    // installed its state everywhere.
    release();

    // Whichever way the older load itself settles — rejecting is the correct
    // outcome, and is asserted below — the state actually observable through
    // the plugin's actions is what must not regress.
    await olderLoad.catch((error: unknown) => error);

    const stillBoundToNewer = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(newerTransaction), ctx: newerTransaction },
      { strategy: 'first' },
    );

    expect(stillBoundToNewer.result.path).toBe('/authorized');

    // The older format's transaction id is not a key in the bound catalog, so
    // a global `authorize` must not apply to it — on the buggy
    // implementation this resolved to '/authorized' too, because the older
    // load's stale `hookRunner.init` had reinstated *its* catalog.
    const notBoundToOlder = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(olderTransaction), ctx: olderTransaction },
      { strategy: 'first' },
    );

    expect(notBoundToOlder.result.path).toBe(olderTransaction.thymianReq.path);

    // And the request-sampler projection, the third dependent of the same
    // event, must agree: only the newer transaction resolves.
    const sampleForNewer = await emitter.emitAction(
      'core.request.sample',
      { transaction: newerTransaction },
      { strategy: 'first' },
    );

    expect(sampleForNewer.path).toBe('/only-in-newer');

    await expect(
      emitter.emitAction(
        'core.request.sample',
        { transaction: olderTransaction },
        { strategy: 'first' },
      ),
    ).rejects.toMatchObject({
      name: 'SampleProjectionMissingTransactionError',
    });

    // And the older load itself: it must reject as superseded rather than
    // resolving as if it had won silently. `requestSampler.init` runs before
    // `hookRunner.init`, so it is the one whose check the older load meets
    // first.
    await expect(olderLoad).rejects.toMatchObject({
      name: 'RequestSamplerSuperseded',
    });
  }, 20_000);
});

/**
 * Two transactions sharing method/path/status/media-type but disjoint hosts —
 * so the request nodes do not dedupe — is `transaction-catalog.test.ts`'s own
 * recipe for a cross-source `SelectorCollisionError`, reused here rather than
 * exported: `createThymianFormatWithTransactions` cannot express two distinct
 * sources, and this file needs exactly one throwing candidate, not the whole
 * fixture surface that suite covers.
 */
function collidingFormat(): ThymianFormat {
  const format = new ThymianFormat();

  for (const [host, source] of [
    ['api.one.example', 'source-one'],
    ['api.two.example', 'source-two'],
  ] as const) {
    format.addHttpTransaction(
      createHttpRequest({
        method: 'GET',
        path: '/users',
        host,
        port: 8080,
        protocol: 'http',
        mediaType: '',
        sourceName: source,
      }),
      createHttpResponse({
        statusCode: 200,
        mediaType: 'application/json',
        sourceName: source,
      }),
      source,
    );
  }

  return format;
}

describe('core.format reload — a candidate that cannot even produce a catalog (round 8b)', () => {
  it('does not destroy previously working state when the new format has a cross-source collision', async () => {
    // `TransactionCatalog.fromThymianFormat` throws by design on a
    // cross-source selector collision — a property of the *candidate*
    // format, discovered before either component's `init` is ever reached.
    // Invalidating before that build could fail left a working dev server
    // fully dark the moment someone introduced a collision: `hookRunner`,
    // `requestSampler` and `samples` were all wiped, the build then threw,
    // and every subsequent action failed — `HookRunnerNotInitialized`,
    // `FormatNotLoadedError` — until a *valid* format loaded, even though the
    // previous one was working seconds earlier. A rejected candidate should
    // be a no-op, not an outage.
    const cwd = await createTempDir('.tmp-sampler-collision-');
    roots.push(cwd);

    const hooksDir = join(cwd, '.thymian', 'sampler', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, 'auth.ts'),
      [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (value) => ({ ...value, path: '/authorized' }));`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    const workingFormat = createThymianFormatWithTransactions(1);

    function firstTxOf(source: ThymianFormat): ThymianHttpTransaction {
      const [transaction] = source.getThymianHttpTransactions();

      if (!transaction) {
        throw new Error('fixture format must contain one transaction');
      }

      return transaction;
    }

    const workingTransaction = firstTxOf(workingFormat);

    const emitter = await bootPlugin(cwd);

    // First, a clean load: hooks bound, a real projection installed.
    await emitter.emitAction('core.format', workingFormat.export(), {
      strategy: 'first',
    });

    const boundBefore = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(workingTransaction), ctx: workingTransaction },
      { strategy: 'first' },
    );

    expect(boundBefore.result.path).toBe('/authorized');

    const sampleBefore = await emitter.emitAction(
      'core.request.sample',
      { transaction: workingTransaction },
      { strategy: 'first' },
    );

    expect(sampleBefore.path).toBe(workingTransaction.thymianReq.path);

    // Now a reload attempt that cannot even build a catalog.
    await expect(
      emitter.emitAction('core.format', collidingFormat().export(), {
        strategy: 'first',
      }),
    ).rejects.toMatchObject({ name: 'SelectorCollisionError' });

    // The previous, working state must still answer — this is the assertion
    // that fails on the pre-fix ordering, where the collision arrived after
    // `hookRunner`/`requestSampler`/`samples` had already been wiped.
    const boundAfter = await emitter.emitAction(
      'http-testing.authorize',
      { value: templateFor(workingTransaction), ctx: workingTransaction },
      { strategy: 'first' },
    );

    expect(boundAfter.result.path).toBe('/authorized');

    const sampleAfter = await emitter.emitAction(
      'core.request.sample',
      { transaction: workingTransaction },
      { strategy: 'first' },
    );

    expect(sampleAfter.path).toBe(workingTransaction.thymianReq.path);
  }, 20_000);
});
