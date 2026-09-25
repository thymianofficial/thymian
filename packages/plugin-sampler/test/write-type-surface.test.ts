import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
  type TypeSurface,
} from '../src/generation/types/generate-type-surface.js';
import {
  readGenerated,
  writeGenerated,
} from '../src/generation/types/write-type-surface.js';
import { resolveSamplerPaths } from '../src/sampler-paths.js';
import { createTempDir } from './utils.js';

const SURFACE: TypeSurface = {
  requestTypes: 'export type Fine = string;\n',
  hooksApi: 'export type AlsoFine = number;\n',
};

/**
 * `generated/` with a stray macOS `.DS_Store` file and a stray subdirectory
 * sitting beside the committed surface — reachable any time a user browses
 * the directory in Finder, or accidentally creates a folder there. Neither
 * was ever written by the sampler, so `readGenerated` must tolerate both:
 * `sync --check`, `validate` and `thymian test` all read through it, and a
 * crash or a false drift signal from an entry the sampler never wrote would
 * hit every one of them.
 */
describe('readGenerated', () => {
  async function withStrayEntries(): Promise<
    ReturnType<typeof resolveSamplerPaths>
  > {
    const cwd = await createTempDir('thymian-write-surface-');
    const paths = resolveSamplerPaths(cwd);

    await writeGenerated(paths, SURFACE);

    await writeFile(join(paths.generatedDir, '.DS_Store'), 'garbage', 'utf-8');
    await mkdir(join(paths.generatedDir, 'stray-subdir'), { recursive: true });
    await writeFile(
      join(paths.generatedDir, 'stray-subdir', 'nested.txt'),
      'nested',
      'utf-8',
    );

    return paths;
  }

  it('never crashes on a stray subdirectory', async () => {
    const paths = await withStrayEntries();

    // If this throws (`EISDIR`, reading `stray-subdir` as a file), the test
    // fails on the rejection itself — there is nothing more to assert.
    const files = await readGenerated(paths);

    expect(files).toBeDefined();
  });

  it('reads exactly the committed surface files, ignoring every stray entry', async () => {
    const paths = await withStrayEntries();

    expect(await readGenerated(paths)).toEqual({
      [HOOKS_API_FILE]: SURFACE.hooksApi,
      [REQUEST_TYPES_FILE]: SURFACE.requestTypes,
    });
  });

  it('does not report a stray entry as drift when the surface is rewritten', async () => {
    const paths = await withStrayEntries();

    // A stray `.DS_Store` or subdirectory is not part of the surface, so
    // rewriting it — even with the same content — must never be reported as
    // though the stray entry itself changed.
    const changed = await writeGenerated(paths, SURFACE);

    expect(changed).toEqual([]);
  });
});
