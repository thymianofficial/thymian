import { mkdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createExpectedSamplerFiles,
  validateSamplerOutput,
} from '../src/validation/validate-sampler-output.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(3);

describe('validateSamplerOutput', () => {
  let tempDir!: string;
  let emitter!: ThymianEmitter;

  beforeEach(async () => {
    tempDir = await createTempDir('validateSamplerOutput-');
    emitter = new ThymianEmitter();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns no failures when generated artifacts are in sync', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.checkedArtifacts).toBeGreaterThan(0);
    expect(report.failures).toEqual([]);
  }, 30_000);

  it('reports changed and missing generated artifacts', async () => {
    await writeExpectedFiles(tempDir, emitter);
    await writeFile(join(tempDir, 'types.d.ts'), 'changed');
    await unlink(join(tempDir, 'tsconfig.json'));

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'changed-artifact',
          path: 'types.d.ts',
        }),
        expect.objectContaining({
          type: 'missing-artifact',
          path: 'tsconfig.json',
        }),
      ]),
    );
  }, 30_000);

  it('reports unexpected artifacts while ignoring hook files', async () => {
    await writeExpectedFiles(tempDir, emitter);
    await writeFile(join(tempDir, 'orphan.json'), '{}');
    await writeFile(join(tempDir, 'custom.beforeEach.ts'), 'export default {}');
    // `notbeforeEach.ts` is NOT a hook: the anchored hook pattern only matches
    // `beforeEach.<ext>` at a boundary (start or after `.`/`/`), so it must be
    // flagged as an unexpected artifact like any other non-hook file.
    await writeFile(join(tempDir, 'notbeforeEach.ts'), 'export default {}');

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'unexpected-artifact',
          path: 'orphan.json',
        }),
        expect.objectContaining({
          type: 'unexpected-artifact',
          path: 'notbeforeEach.ts',
        }),
      ]),
    );
    expect(report.failures).toHaveLength(2);
  }, 30_000);

  it('reports missing artifacts without creating a missing samples directory', async () => {
    const samplePath = join(tempDir, 'missing');

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath,
    });

    expect(report.failures.length).toBe(report.checkedArtifacts);
    expect(report.failures[0]).toEqual(
      expect.objectContaining({
        type: 'missing-artifact',
      }),
    );

    await expect(stat(samplePath)).rejects.toThrow();
  }, 30_000);

  it('treats a non-directory samples path as an empty actual set', async () => {
    const samplePath = join(tempDir, 'samples-as-file');
    await writeFile(samplePath, 'not a directory');

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath,
    });

    // A file where the samples directory is expected must not crash `readdir`;
    // every expected artifact should simply be reported as missing.
    expect(report.failures.length).toBe(report.checkedArtifacts);
    expect(
      report.failures.every((failure) => failure.type === 'missing-artifact'),
    ).toBe(true);
  }, 30_000);

  it('reports stale root metadata when the format hash differs', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const metaPath = join(tempDir, 'meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    meta.version.version = 'old-format-hash';
    await writeFile(metaPath, JSON.stringify(meta));

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual([
      expect.objectContaining({
        type: 'stale-root-metadata',
        path: 'meta.json',
        changes: expect.arrayContaining([
          expect.objectContaining({
            type: 'update',
            pointer: '/version/version',
          }),
        ]),
      }),
    ]);
  }, 30_000);

  it('reports invalid JSON for generated JSON artifacts', async () => {
    await writeExpectedFiles(tempDir, emitter);

    await writeFile(join(tempDir, 'tsconfig.json'), '{');

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual([
      expect.objectContaining({
        type: 'invalid-json',
        path: 'tsconfig.json',
      }),
    ]);
  }, 30_000);

  it('reports nested metadata that is out of sync', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const expectedFiles = await createExpectedSamplerFiles({ format, emitter });
    const nestedMetaPath = [...expectedFiles.keys()].find(
      (path) => path !== 'meta.json' && path.endsWith('/meta.json'),
    );

    if (!nestedMetaPath) {
      throw new Error('Expected at least one nested sampler metadata file.');
    }

    await writeFile(
      join(tempDir, nestedMetaPath),
      JSON.stringify({ version: 'changed' }),
    );

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual([
      expect.objectContaining({
        type: 'metadata-out-of-sync',
        path: nestedMetaPath,
        changes: expect.arrayContaining([
          expect.objectContaining({
            type: 'add',
            pointer: '/version',
          }),
        ]),
      }),
    ]);
  }, 30_000);

  it('reports a changed artifact when non-hash root metadata drifts', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const metaPath = join(tempDir, 'meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    // Keep the format hash (`/version/version`) intact and drift an unrelated
    // field: this is an ordinary content change, not stale format metadata.
    meta.transactions = { ...(meta.transactions ?? {}), injected: 'drift' };
    await writeFile(metaPath, JSON.stringify(meta));

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual([
      expect.objectContaining({
        type: 'changed-artifact',
        path: 'meta.json',
        changes: expect.arrayContaining([
          expect.objectContaining({
            type: 'add',
            pointer: '/transactions/injected',
          }),
        ]),
      }),
    ]);
  }, 30_000);

  it('ignores timestamp-only root metadata differences', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const metaPath = join(tempDir, 'meta.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    meta.version.timestamp = 1_234_567;
    await writeFile(metaPath, JSON.stringify(meta));

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    expect(report.failures).toEqual([]);
  }, 30_000);

  it('returns full, untruncated change lists and content', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const replacement: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      replacement[`key-${i}`] = i;
    }
    await writeFile(join(tempDir, 'meta.json'), JSON.stringify(replacement));

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
    });

    const finding = report.failures.find((f) => f.path === 'meta.json');

    expect(finding?.changes?.length).toBeGreaterThan(20);
    expect(finding?.expected?.endsWith('...')).toBe(false);
  }, 30_000);

  it('scopes the report to a single artifact with forPath', async () => {
    await writeExpectedFiles(tempDir, emitter);
    await writeFile(join(tempDir, 'types.d.ts'), 'changed');
    await writeFile(join(tempDir, 'orphan.json'), '{}');

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
      forPath: 'types.d.ts',
    });

    expect(report.checkedArtifacts).toBe(1);
    expect(report.failures).toEqual([
      expect.objectContaining({
        type: 'changed-artifact',
        path: 'types.d.ts',
      }),
    ]);
  }, 30_000);

  it('reports an in-sync artifact as checked with no failures via forPath', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
      forPath: 'tsconfig.json',
    });

    expect(report.checkedArtifacts).toBe(1);
    expect(report.failures).toEqual([]);
  }, 30_000);

  it('marks an unknown forPath as not checked', async () => {
    await writeExpectedFiles(tempDir, emitter);

    const report = await validateSamplerOutput({
      format,
      emitter,
      samplePath: tempDir,
      forPath: 'does-not-exist.json',
    });

    expect(report.checkedArtifacts).toBe(0);
    expect(report.failures).toEqual([]);
  }, 30_000);
});

async function writeExpectedFiles(
  samplePath: string,
  emitter: ThymianEmitter,
): Promise<void> {
  const expectedFiles = await createExpectedSamplerFiles({ format, emitter });

  for (const [relativePath, content] of expectedFiles) {
    const filePath = join(samplePath, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
}
