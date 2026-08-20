import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { HttpRequestTemplate } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterAll, describe, expect, it } from 'vitest';

import {
  isHookFile,
  loadUserHooks,
  type LoadUserHooksResult,
} from '../src/hooks/load-user-hooks.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(3);
const catalog = TransactionCatalog.fromThymianFormat(format);
const [selectorA, selectorB, selectorC] = catalog.selectors();

if (!selectorA || !selectorB || !selectorC) {
  throw new Error('fixture format must render three selectors');
}

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

/**
 * Builds a hooks directory that sits under **two** dot-segments — the temp root
 * itself and `.thymian`. A dot check computed on the absolute path rather than on
 * the hooks-dir-relative one would skip every file here, which is exactly the
 * real-world layout (`.thymian/sampler/hooks`) the rule must not swallow.
 */
async function writeHooks(files: Record<string, string>): Promise<string> {
  const root = await createTempDir('.tmp-sampler-hooks-');
  roots.push(root);

  const hooksDir = join(root, '.thymian', 'sampler', 'hooks');
  await mkdir(hooksDir, { recursive: true });

  for (const [relative, content] of Object.entries(files)) {
    const full = join(hooksDir, relative);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, 'utf-8');
  }

  return hooksDir;
}

/** A hook file whose `beforeEach` appends `tag` to the request path. */
function tagging(selector: string, tag: string): string {
  return [
    `import { beforeEach } from '@thymian/hooks';`,
    `export const hook = beforeEach(${JSON.stringify(selector)}, async (value) => ({`,
    `  ...value,`,
    `  path: value.path + ${JSON.stringify(tag)},`,
    `}));`,
    ``,
  ].join('\n');
}

const template = { path: '' } as unknown as HttpRequestTemplate;

/** Runs the bound `beforeEach` chain so composition order is observable. */
async function compose(
  result: LoadUserHooksResult,
  transactionId: string,
): Promise<string> {
  const hooks = result.perTransaction.get(transactionId);
  let value = template;

  for (const hook of hooks?.beforeEach ?? []) {
    value = await hook(value, undefined, undefined as never);
  }

  return value.path;
}

function firstTransactionId(): string {
  const transaction = catalog.tryResolve(selectorA);

  if (!transaction) {
    throw new Error('fixture selector must resolve');
  }

  return transaction.transactionId;
}

function errorsOf(result: LoadUserHooksResult): string[] {
  return result.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.file}: ${diagnostic.reason}`);
}

describe('isHookFile', () => {
  it('keeps every JS/TS module extension the spec names', () => {
    for (const name of [
      'a.js',
      'a.mjs',
      'a.cjs',
      'a.ts',
      'a.mts',
      'a.cts',
      '.eslintrc.ts',
      'a.b.c.ts',
    ]) {
      expect(isHookFile(name), name).toBe(true);
    }
  });

  it('skips declaration files in all three flavours', () => {
    for (const name of ['types.d.ts', 'types.d.mts', 'types.d.cts']) {
      expect(isHookFile(name), name).toBe(false);
    }
  });

  it('skips everything that is not a module', () => {
    for (const name of [
      'notes.md',
      'sample.json',
      'a.tsx',
      'a.jsx',
      'README',
      'a.ts.bak',
      '.gitignore',
    ]) {
      expect(isHookFile(name), name).toBe(false);
    }
  });
});

describe('loadUserHooks — the scan', () => {
  it('treats a missing hooks directory as zero hooks and zero diagnostics', async () => {
    const root = await createTempDir('.tmp-sampler-hooks-');
    roots.push(root);

    const result = await loadUserHooks(join(root, 'nope', 'hooks'), catalog);

    expect(result.diagnostics).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(result.perTransaction.size).toBe(0);
    expect(result.fileCount).toBe(0);
  });

  it('walks recursively and composes in sorted relative-path order', async () => {
    const hooksDir = await writeHooks({
      'a.ts': tagging(selectorA, 'a'),
      'nested/b.ts': tagging(selectorA, 'b'),
      'nested/deep/c.ts': tagging(selectorA, 'c'),
      '.eslintrc.ts': tagging(selectorA, 'dot'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(4);
    // "." (0x2E) sorts before "a"; "a.ts" before "nested/...".
    expect(await compose(result, firstTransactionId())).toBe('dotabc');
  });

  it('keeps a dot-file but skips a dot-directory', async () => {
    const hooksDir = await writeHooks({
      '.eslintrc.ts': tagging(selectorA, 'kept'),
      '.hidden/x.ts': tagging(selectorA, 'skipped'),
      'visible/.buried/y.ts': tagging(selectorA, 'also-skipped'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.fileCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('kept');
  });

  it('skips declaration files and non-modules', async () => {
    const hooksDir = await writeHooks({
      'a.ts': tagging(selectorA, 'a'),
      'types.d.ts': 'export type Nope = never;\n',
      'notes.md': '# not a hook\n',
      'sample.json': '{}\n',
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.fileCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('a');
  });

  it('reports a hooks path that is not a walkable directory', async () => {
    const root = await createTempDir('.tmp-sampler-hooks-');
    roots.push(root);

    const notADirectory = join(root, 'hooks');
    await writeFile(notADirectory, 'not a directory\n', 'utf-8');

    const result = await loadUserHooks(notADirectory, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('could not be read');
  });
});

describe('loadUserHooks — collecting exports', () => {
  it('collects named, default and array exports, and never calls a helper', async () => {
    const hooksDir = await writeHooks({
      'many.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const tag = (t) => async (value) => ({ ...value, path: value.path + t });`,
        `export const named = beforeEach(${JSON.stringify(selectorA)}, tag('n'));`,
        `export default beforeEach(${JSON.stringify(selectorA)}, tag('d'));`,
        `export const pair = [`,
        `  beforeEach(${JSON.stringify(selectorA)}, tag('1')),`,
        `  beforeEach(${JSON.stringify(selectorA)}, tag('2')),`,
        `];`,
        `export function helper() {`,
        `  throw new Error('an exported helper must never be invoked');`,
        `}`,
        `export const constant = 42;`,
        `export const notAHook = { kind: 'beforeEach' };`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);

    const composed = await compose(result, firstTransactionId());

    // Four registrations, ordered by their creation index — not by the sorted
    // key order an ESM namespace would yield (`default`, `named`, `pair`).
    expect(composed).toHaveLength(4);
    expect(composed).toBe('nd12');
  });

  it('collects the same registration once when it is reachable twice', async () => {
    const hooksDir = await writeHooks({
      'aliased.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const shared = beforeEach(${JSON.stringify(selectorA)}, async (value) => ({`,
        `  ...value,`,
        `  path: value.path + 'x',`,
        `}));`,
        `export default shared;`,
        `export const alias = shared;`,
        `export const alsoAlias = shared;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    // Without identity dedupe this composes three times — and a single
    // `defineSample` would become a phantom duplicate conflict.
    expect(await compose(result, firstTransactionId())).toBe('x');
  });

  it('does not flatten a nested array, and says so', async () => {
    const hooksDir = await writeHooks({
      'nested-array.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const groups = [[beforeEach(${JSON.stringify(selectorA)}, async (v) => v)]];`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.perTransaction.size).toBe(0);
    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('but not exported');
  });

  it('reports a registration that was created but never exported', async () => {
    const hooksDir = await writeHooks({
      'forgot.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        `beforeEach(${JSON.stringify(selectorB)}, async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toMatch(
      /2 registration\(s\) created while loading "forgot\.ts" but not exported/,
    );
  });

  it('does not accuse a file that only re-exports a shared hook module', async () => {
    // The false positive a per-file diff produces: jiti evaluates `lib.ts`
    // inside `a.ts`'s import window, so the registration is "created during
    // a.ts" while being exported from `lib.ts`.
    const hooksDir = await writeHooks({
      'a.ts': [`export { shared } from './lib.js';`, ``].join('\n'),
      'lib.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const shared = beforeEach(${JSON.stringify(selectorA)}, async (value) => ({`,
        `  ...value,`,
        `  path: value.path + 's',`,
        `}));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    // Reachable from two files, still one binding: identity dedupe is global.
    expect(await compose(result, firstTransactionId())).toBe('s');
  });

  it('never collects — or calls — a branded callable export', async () => {
    const hooksDir = await writeHooks({
      'callable.ts': [
        `import { writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        `const marker = join(import.meta.dirname, 'called.txt');`,
        `function pretender() {`,
        `  writeFileSync(marker, 'called');`,
        `  return undefined;`,
        `}`,
        `pretender.kind = 'beforeEach';`,
        `pretender.order = 0;`,
        `pretender[Symbol.for('@thymian/plugin-sampler.hook-registration')] = true;`,
        `export const hook = pretender;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // Not a registration, not a diagnostic, and above all not invoked: the
    // predicate refuses callables before it reads a single property.
    expect(result.perTransaction.size).toBe(0);
    expect(errorsOf(result)).toEqual([]);
    await expect(
      readFile(join(hooksDir, 'called.txt'), 'utf-8'),
    ).rejects.toThrow();
  });

  it('errors on a branded value carrying an unrecognised kind', async () => {
    const hooksDir = await writeHooks({
      'skewed.ts': [
        `export const weird = Object.freeze({`,
        `  kind: 'overrideSample',`,
        `  order: 0,`,
        `  target: ${JSON.stringify(selectorA)},`,
        `  callback: async (value) => value,`,
        `  [Symbol.for('@thymian/plugin-sampler.hook-registration')]: true,`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain(
      'unrecognised kind "overrideSample"',
    );
  });

  it('turns a file that throws at import into one diagnostic and keeps scanning', async () => {
    const hooksDir = await writeHooks({
      'aaa-broken.ts': `throw new Error('module scope explodes');\n`,
      'bbb-fine.ts': tagging(selectorA, 'fine'),
      'ccc-also-fine.ts': tagging(selectorA, 'also'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('aaa-broken.ts');
    expect(errorsOf(result)[0]).toContain('module scope explodes');
    // The two healthy files still bound, in order.
    expect(await compose(result, firstTransactionId())).toBe('finealso');
  });
});

describe('loadUserHooks — run-scoped hooks', () => {
  it('collects beforeAll/afterAll in registration order without invoking them', async () => {
    const hooksDir = await writeHooks({
      'run.ts': [
        `import { afterAll, beforeAll } from '@thymian/hooks';`,
        `const explode = () => { throw new Error('must not run at load time'); };`,
        `export const first = beforeAll(explode);`,
        `export const second = beforeAll(explode);`,
        `export const last = afterAll(explode);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.runScoped.beforeAll.map((entry) => entry.exportName)).toEqual(
      ['first', 'second'],
    );
    expect(result.runScoped.afterAll.map((entry) => entry.exportName)).toEqual([
      'last',
    ]);
    // Nothing bound them to a transaction, and nothing ran them.
    expect(result.perTransaction.size).toBe(0);
  });
});
