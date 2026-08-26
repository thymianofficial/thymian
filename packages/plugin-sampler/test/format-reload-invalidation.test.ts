import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type HttpRequestTemplate,
  ThymianEmitter,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterAll, describe, expect, it } from 'vitest';

import { samplePlugin } from '../src/index.js';
import { samplesTreeFromThymianHttpTransaction } from '../src/samples-structure/samples-from-transactions.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

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
