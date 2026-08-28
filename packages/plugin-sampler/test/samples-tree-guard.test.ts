import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { ThymianBaseError } from '@thymian/core';
import { createMockLogger } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  extractHooksFromDir,
  isPathTraversalError,
  readSamplesFromDirIfUsable,
} from '../src/samples-structure/read-samples-from-dir.js';
import { samplesTreeFromThymianHttpTransaction } from '../src/samples-structure/samples-from-transactions.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { PATH_TRAVERSAL_ERROR_NAME } from '../src/utils.js';
import { createTempDir } from './utils.js';

function fixtureTree(dir: string) {
  return samplesTreeFromThymianHttpTransaction(
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
    dir,
  );
}

describe('readSamplesFromDirIfUsable (#613)', () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('thymian-samples-guard-');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns undefined for an absent tree, silently', async () => {
    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(join(tempDir, 'nope'), logger),
    ).resolves.toBeUndefined();

    // Absent is the normal case since samples went virtual; it is not worth a
    // line of output.
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('returns undefined for a tree with no meta.json', async () => {
    const samplesDir = join(tempDir, 'samples');
    await mkdir(samplesDir, { recursive: true });
    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(samplesDir, logger),
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('could not be read'),
    );
  });

  it('returns undefined for a truncated meta.json, at a louder log level', async () => {
    // A tree exists and does not parse — the one case #613's own follow-up
    // review distinguished from "nothing is here": the run still never
    // throws and the tree is still `undefined`, but a `SyntaxError` is a
    // real defect, not the ordinary absence AC 12's `logger.debug` line is
    // for. `warn`, not `debug`, so it is visible at the default log level
    // instead of indistinguishable from the absent-tree case.
    const samplesDir = join(tempDir, 'samples');
    await mkdir(samplesDir, { recursive: true });
    await writeFile(join(samplesDir, 'meta.json'), '{', 'utf-8');
    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(samplesDir, logger),
    ).resolves.toBeUndefined();

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not be read'),
    );
  });

  it('returns undefined for a half-written tree whose node meta is missing', async () => {
    // `extractSamplesNode` reads a *second* `meta.json`, one level down. A tree
    // interrupted mid-write has the root metadata and not the node's.
    const samplesDir = join(tempDir, 'samples');
    await writeSamplesToDir(fixtureTree(samplesDir), {}, { path: samplesDir });

    const nodeMeta = join(
      samplesDir,
      'test',
      'localhost',
      '8080',
      'status',
      '@GET',
      '200',
      'meta.json',
    );
    await rm(nodeMeta, { force: true });

    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(samplesDir, logger),
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalled();
  });

  it('re-raises a refused path traversal instead of demoting it to debug', async () => {
    // `checkForSafePath` exists to make a sample file escaping its base
    // directory a hard failure, and `readSamplesFromDir` is its only remaining
    // call path (`index.ts:226`). The bare `catch` here swallowed it, so the
    // guard made the refusal unreachable — the sampler read a tree it had just
    // decided was unsafe and said `logger.debug`. AC 12 asks the guard to
    // tolerate the *unparseable*, not the *forbidden*.
    const samplesDir = join(tempDir, 'samples');
    await writeSamplesToDir(fixtureTree(samplesDir), {}, { path: samplesDir });

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

    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(samplesDir, logger),
    ).rejects.toThrow(/outside of the base directory/);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  // `chmod 000` does not stop a root user and means nothing on Windows, so the
  // case is skipped where it cannot be staged rather than asserted vacuously.
  const canRefuseReads =
    process.platform !== 'win32' && process.getuid?.() !== 0;

  it.skipIf(!canRefuseReads)(
    'degrades an unreadable tree and names the permission problem (AC 9, AC 12)',
    async () => {
      // A root-created `.thymian/samples` in a container, or a CI job running as
      // a different user, is the paradigm "present but unreadable" case. AC 9
      // says this read never throws out of `core.format` and AC 12 says such a
      // tree still runs clean, so re-raising made `thymian test`, `sampler init`
      // and `sampler check` all hard-fail on a tree none of them needs.
      //
      // What round 1 actually objected to was the *diagnosis* — `No samples are
      // loaded.` for a tree that is right there — and that is answered by
      // saying `EACCES` out loud rather than by killing the run.
      const samplesDir = join(tempDir, 'samples');
      await writeSamplesToDir(
        fixtureTree(samplesDir),
        {},
        { path: samplesDir },
      );

      const metaPath = join(samplesDir, 'meta.json');
      await chmod(metaPath, 0o000);

      const logger = createMockLogger();

      try {
        await expect(
          readSamplesFromDirIfUsable(samplesDir, logger),
        ).resolves.toBeUndefined();

        const said = logger.debug.mock.calls.map(([line]) => line).join('\n');

        expect(said).toContain('EACCES');
        expect(said).toContain('may not read it');
        // Not the generic "could not be read" line: a permission problem and a
        // truncated `meta.json` are different fixes.
        expect(said).not.toContain('could not be read');
      } finally {
        await chmod(metaPath, 0o644);
      }
    },
  );

  it('re-raises a path traversal wrapped inside another error', async () => {
    // The guard used to inspect only the top-level error, so any future wrap
    // silently demoted a refused path traversal to `logger.debug` — the exact
    // failure the bare `catch` had.
    const traversal = new ThymianBaseError('Access denied. Path "…"', {
      name: PATH_TRAVERSAL_ERROR_NAME,
    });

    expect(isPathTraversalError(traversal)).toBe(true);
    expect(
      isPathTraversalError(new Error('wrapped', { cause: traversal })),
    ).toBe(true);
    expect(
      isPathTraversalError(
        new Error('outer', { cause: new Error('inner', { cause: traversal }) }),
      ),
    ).toBe(true);
    expect(isPathTraversalError(new Error('unrelated'))).toBe(false);
    expect(isPathTraversalError(undefined)).toBe(false);
  });

  it('does not mistake a self-referential cause chain for a traversal', () => {
    const looped = new Error('loop');
    (looped as { cause?: unknown }).cause = looped;

    expect(isPathTraversalError(looped)).toBe(false);
  });

  it('still returns a usable tree, so the guard is not a blanket disable', async () => {
    const samplesDir = join(tempDir, 'samples');
    await writeSamplesToDir(fixtureTree(samplesDir), {}, { path: samplesDir });

    const result = await readSamplesFromDirIfUsable(
      samplesDir,
      createMockLogger(),
    );

    expect(result).toBeDefined();
    expect(result?.type).toBe('root');
  });
});

describe('extractHooksFromDir imports nothing (#615)', () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('thymian-v1-hooks-');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('does not execute a v1 hook file that would leave a marker behind', async () => {
    // "No v1 hook file is imported or executed" is only demonstrable with an
    // observable side effect: a v1 hook that merely returns its input is
    // invisible whether it ran or not.
    const marker = join(tempDir, 'v1-hook-ran.txt');

    await writeFile(
      join(tempDir, 'beforeEach.ts'),
      [
        `import { writeFileSync } from 'node:fs';`,
        `writeFileSync(${JSON.stringify(marker)}, 'imported');`,
        `export default async (value) => value;`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    const hooks = extractHooksFromDir(tempDir);

    expect(hooks).toEqual({
      afterEachResponse: [],
      authorize: [],
      beforeEachRequest: [],
    });

    await expect(readFile(marker, 'utf-8')).rejects.toThrow();
  });

  it('does not fail on a v1 hook file that would throw at import', async () => {
    // v1 raised `HookImportError` for a file it could not import. Nothing reads
    // these files any more, so a broken leftover must not fail a run.
    await writeFile(
      join(tempDir, 'authorize.ts'),
      `throw new Error('a leftover v1 hook that no longer parses');\n`,
      'utf-8',
    );

    expect(extractHooksFromDir(tempDir)).toEqual({
      afterEachResponse: [],
      authorize: [],
      beforeEachRequest: [],
    });
  });

  it('does not import v1 hook files while reading a whole tree', async () => {
    const samplesDir = join(tempDir, 'samples');
    await writeSamplesToDir(fixtureTree(samplesDir), {}, { path: samplesDir });

    const marker = join(tempDir, 'tree-hook-ran.txt');

    await writeFile(
      join(samplesDir, 'beforeEach.ts'),
      [
        `import { writeFileSync } from 'node:fs';`,
        `writeFileSync(${JSON.stringify(marker)}, 'imported');`,
        `export default async (value) => value;`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    const result = await readSamplesFromDirIfUsable(
      samplesDir,
      createMockLogger(),
    );

    expect(result).toBeDefined();
    await expect(readFile(marker, 'utf-8')).rejects.toThrow();
  });
});
