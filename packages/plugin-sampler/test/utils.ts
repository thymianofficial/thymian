import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { toTypeScriptPath } from '../src/ts-path.js';

export async function createTempDir(name: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), name));
}

/**
 * The byte image of a value, for the determinism assertions the sampler spec
 * states as byte-identity.
 *
 * Deliberately `JSON.stringify` and not a key-sorting stringifier: property
 * order is part of the bytes, and a sorted image would pass while the generator
 * emitted headers or parameters in a different order each run — which is
 * exactly the nondeterminism these assertions exist to catch.
 */
export function bytes(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Every entry under `dir`, recursively, as `/`-normalized paths relative to
 * it. An empty array is the assertion that the sampler materialized nothing.
 *
 * Assertions against this compare its result to a literal forward-slashed
 * path, so the entries go through {@link toTypeScriptPath}: `join` yields
 * backslashes on Windows, which would make every one of those literals fail
 * for a reason that has nothing to do with what the sampler wrote.
 */
export async function listTree(dir: string): Promise<string[]> {
  const entries = await readdir(dir, {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) =>
      toTypeScriptPath(
        join(entry.parentPath, entry.name).slice(dir.length + 1),
      ),
    )
    .sort();
}
