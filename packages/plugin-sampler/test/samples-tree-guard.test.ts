import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createMockLogger } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  extractHooksFromDir,
  readSamplesFromDirIfUsable,
} from '../src/samples-structure/read-samples-from-dir.js';
import { samplesTreeFromThymianHttpTransaction } from '../src/samples-structure/samples-from-transactions.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
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

  it('returns undefined for a truncated meta.json', async () => {
    const samplesDir = join(tempDir, 'samples');
    await mkdir(samplesDir, { recursive: true });
    await writeFile(join(samplesDir, 'meta.json'), '{', 'utf-8');
    const logger = createMockLogger();

    await expect(
      readSamplesFromDirIfUsable(samplesDir, logger),
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalled();
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

    const hooks = await extractHooksFromDir(tempDir);

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

    await expect(extractHooksFromDir(tempDir)).resolves.toEqual({
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
