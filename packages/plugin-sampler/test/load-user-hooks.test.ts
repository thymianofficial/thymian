import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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

/** The `Symbol.for` brand, as a hook file would write it. */
const BRAND = `Symbol.for('@thymian/plugin-sampler.hook-registration')`;

/**
 * The creation log's `globalThis` slot, as a **version-skewed** `@thymian/hooks`
 * runtime would reach it: same `Symbol.for` key, a `kind` this plugin does not
 * know. That combination — logged as created *and* rejected as unrecognised — is
 * the one the scan-wide diff used to double-report.
 */
const CREATION_LOG = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

function errorsOf(result: LoadUserHooksResult): string[] {
  return result.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.file}: ${diagnostic.reason}`);
}

function anchorsOf(result: LoadUserHooksResult): (string | undefined)[] {
  return result.diagnostics
    .filter((diagnostic) => diagnostic.kind !== undefined)
    .map((diagnostic) => diagnostic.anchor);
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

describe('loadUserHooks — a second load in the same process', () => {
  /**
   * jiti's `moduleCache` is not per-instance: at its default it delegates to
   * Node's `require.cache`, which is keyed on resolved filename and lives on the
   * *process*. Building the `Jiti` instance inside `loadUserHooks` therefore
   * isolated nothing, and these two cases both passed for the wrong reason —
   * they never ran a second load against the same directory.
   */
  it('re-reads a hook file that changed on disk between two loads', async () => {
    const hooksDir = await writeHooks({ 'edit.ts': tagging(selectorA, 'a') });

    const first = await loadUserHooks(hooksDir, catalog);

    expect(anchorsOf(first)).toEqual([`"${selectorA}"`]);

    await writeFile(
      join(hooksDir, 'edit.ts'),
      tagging(selectorB, 'a'),
      'utf-8',
    );

    const second = await loadUserHooks(hooksDir, catalog);

    // The stale read reported the *old* selector as `resolved to 1
    // transaction(s)`, so a hook the user had just repointed kept running the
    // code it used to have while reporting a clean bind.
    expect(anchorsOf(second)).toEqual([`"${selectorB}"`]);
  });

  it('re-reads an imported module that changed on disk', async () => {
    // The dependency case, which the top-level one does not cover: with jiti's
    // `moduleCache` left on, a nested specifier is served from `require.cache`
    // even when the scan re-evaluates the file that imports it. The hook the
    // user edited is the one in `lib.ts`.
    const hooksDir = await writeHooks({
      'a.ts': [`export { shared } from './lib.js';`, ``].join('\n'),
      'lib.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const shared = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const first = await loadUserHooks(hooksDir, catalog);

    expect(anchorsOf(first)).toEqual([`"${selectorA}"`]);

    await writeFile(
      join(hooksDir, 'lib.ts'),
      [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const shared = beforeEach(${JSON.stringify(selectorB)}, async (v) => v);`,
        ``,
      ].join('\n'),
      'utf-8',
    );

    const second = await loadUserHooks(hooksDir, catalog);

    expect(anchorsOf(second)).toEqual([`"${selectorB}"`]);
  });

  it('keeps reporting an unexported registration on every load', async () => {
    const hooksDir = await writeHooks({
      'forgot.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const first = await loadUserHooks(hooksDir, catalog);

    expect(first.hasErrors).toBe(true);

    const second = await loadUserHooks(hooksDir, catalog);

    // With a process-global module cache the body never re-executed, so
    // `registerHook` never fired, the creation log stayed empty, and the second
    // load reported `hasErrors: false` with **zero** diagnostics — a false clean
    // for exactly the hook the first load had rejected.
    expect(second.hasErrors).toBe(true);
    expect(errorsOf(second).join('\n')).toContain('but not exported');
  });

  it('still evaluates a shared module once per scan', async () => {
    // The invariant the cache fix must not trade away: with no module cache at
    // all, `lib.ts` reached both directly and through `a.ts` is evaluated twice
    // and one authored hook becomes two registrations. The per-scan cache keyed
    // on jiti's own resolved path is what keeps it at one — checked here across
    // two loads, because a scan-scoped cache that leaked would show up as a
    // *second* binding on the second load.
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

    expect(
      await compose(
        await loadUserHooks(hooksDir, catalog),
        firstTransactionId(),
      ),
    ).toBe('s');
    expect(
      await compose(
        await loadUserHooks(hooksDir, catalog),
        firstTransactionId(),
      ),
    ).toBe('s');
  });
});

describe('loadUserHooks — a user value that fights back', () => {
  /**
   * Five shapes, five boundaries. Each one used to throw straight out of
   * `loadUserHooks` → `HookRunner.init` → `core.format` as an unformatted error
   * with no `file:` attribution — breaking both of this module's stated
   * contracts ("never throws for user error", "one broken file must not hide the
   * other nine") and AC 5's "tolerates an export whose property access throws",
   * which `isHookRegistration` honours and the next line defeated.
   *
   * Every case asserts the *other* hook in the same scan still bound: a
   * diagnostic that stops the scan is only half a fix.
   */
  it('reports a namespace whose enumerable getter throws, and keeps the file', async () => {
    const hooksDir = await writeHooks({
      'hostile-namespace.cts': [
        `const { beforeEach } = require('@thymian/hooks');`,
        `const good = beforeEach(${JSON.stringify(selectorA)}, async (value) => ({`,
        `  ...value,`,
        `  path: value.path + 'g',`,
        `}));`,
        `module.exports = { good };`,
        `Object.defineProperty(module.exports, 'boom', {`,
        `  enumerable: true,`,
        `  get() { throw new Error('namespace getter exploded'); },`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result).join('\n')).toContain('namespace getter exploded');
    expect(errorsOf(result)[0]).toContain('hostile-namespace.cts');
    // The sibling export in the same namespace still bound.
    expect(await compose(result, firstTransactionId())).toBe('g');
  });

  it('reports a branded proxy whose `kind` read throws', async () => {
    const hooksDir = await writeHooks({
      'a-fine.ts': tagging(selectorA, 'fine'),
      'b-proxy.ts': [
        `export const proxied = new Proxy({}, {`,
        `  get(target, property) {`,
        `    if (property === ${BRAND}) {`,
        `      return true;`,
        `    }`,
        `    throw new Error('kind read exploded');`,
        `  },`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result).join('\n')).toContain('kind read exploded');
    expect(errorsOf(result).join('\n')).toContain('b-proxy.ts');
    expect(await compose(result, firstTransactionId())).toBe('fine');
  });

  it('reports the one element of an exported array whose read throws', async () => {
    const hooksDir = await writeHooks({
      'proxy-array.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const tag = (t) => async (value) => ({ ...value, path: value.path + t });`,
        `const real = [`,
        `  beforeEach(${JSON.stringify(selectorA)}, tag('0')),`,
        `  beforeEach(${JSON.stringify(selectorA)}, tag('1')),`,
        `];`,
        `export const list = new Proxy(real, {`,
        `  get(target, property) {`,
        `    if (property === '1') {`,
        `      throw new Error('element read exploded');`,
        `    }`,
        `    return Reflect.get(target, property);`,
        `  },`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result).join('\n')).toContain('element read exploded');
    expect(errorsOf(result).join('\n')).toContain('list[1]');
    // Element 0 was read before element 1 threw, and it still bound: the guard
    // is per element, not one `try` around the whole array.
    expect(await compose(result, firstTransactionId())).toBe('0');
  });

  it('renders a selector-list element whose `Symbol.toPrimitive` throws', async () => {
    const hooksDir = await writeHooks({
      'hostile-selector.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const hostile = {`,
        `  [Symbol.toPrimitive]() { throw new Error('toPrimitive exploded'); },`,
        `};`,
        `export const h = beforeEach([${JSON.stringify(selectorA)}, hostile], async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // Two coercion sites, both outside any guard before: `describeTarget`'s
    // `String(selector)` (only `JSON.stringify` was wrapped) and the failure
    // message that interpolates the selector inside the catch block meant to
    // report it.
    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('hostile-selector.ts');
    expect(errorsOf(result).join('\n')).toContain('[unprintable value]');
  });

  it('reports a branded value whose `callback` getter throws', async () => {
    const hooksDir = await writeHooks({
      'a-fine.ts': tagging(selectorA, 'fine'),
      'b-callback.ts': [
        `export const bad = {`,
        `  kind: 'beforeEach',`,
        `  order: 0,`,
        `  target: ${JSON.stringify(selectorA)},`,
        `  get callback() { throw new Error('callback read exploded'); },`,
        `  [${BRAND}]: true,`,
        `};`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result).join('\n')).toContain('callback read exploded');
    expect(errorsOf(result).join('\n')).toContain('b-callback.ts');
    expect(await compose(result, firstTransactionId())).toBe('fine');
  });

  it('reports a branded value whose callback is not callable', async () => {
    const hooksDir = await writeHooks({
      'not-callable.ts': [
        `export const bad = {`,
        `  kind: 'beforeEach',`,
        `  order: 0,`,
        `  target: ${JSON.stringify(selectorA)},`,
        `  callback: 42,`,
        `  [${BRAND}]: true,`,
        `};`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // Binding it anyway deferred the failure to the first request, long after
    // the load-time report the user was reading.
    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('callback is not a function');
    expect(result.perTransaction.size).toBe(0);
  });
});

describe('loadUserHooks — the created-but-not-exported diff', () => {
  it('is taken across the scan, not per file', async () => {
    // `a.ts` imports `lib.ts` for its side effect and re-exports **nothing**, so
    // the registration is created inside `a.ts`'s import window and exported
    // only from `lib.ts`. A per-file diff calls that a mistake on `a.ts`; the
    // scan-wide diff sees it exported and says nothing. The existing shared-hook
    // case cannot pin this — there `a.ts` re-exports the value, so per-file and
    // scan-wide agree.
    const hooksDir = await writeHooks({
      'a.ts': [`import './lib.js';`, `export const unrelated = 1;`, ``].join(
        '\n',
      ),
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
    expect(await compose(result, firstTransactionId())).toBe('s');
  });

  it('does not double-report a branded value of an unrecognised kind', async () => {
    // A version-skewed `@thymian/hooks` logs its creation and then fails this
    // plugin's kind check. It is *exported*; the correct diagnostic is the
    // version-skew one, and the second "assign them to an export" error told the
    // user to do something they had already done.
    const hooksDir = await writeHooks({
      'skewed.ts': [
        `const registration = Object.freeze({`,
        `  kind: 'overrideSample',`,
        `  order: 0,`,
        `  target: ${JSON.stringify(selectorA)},`,
        `  callback: async (value) => value,`,
        `  [${BRAND}]: true,`,
        `});`,
        `${CREATION_LOG}.created.push(registration);`,
        `export const weird = registration;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('unrecognised kind "overrideSample"');
  });

  it('does not add a second error to a file that threw at module scope', async () => {
    const hooksDir = await writeHooks({
      'boom.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `throw new Error('module scope explodes');`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // The file has already failed the run by name. The registration it managed
    // to create before throwing is a consequence of that failure, not a second,
    // independent mistake with a remedy of its own.
    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('module scope explodes');
  });
});

describe('loadUserHooks — symlinked hook files', () => {
  it('loads a hook file reached through a symlink', async () => {
    const hooksDir = await writeHooks({
      'real/target.ts': tagging(selectorA, 'linked'),
    });

    await symlink(
      join(hooksDir, 'real', 'target.ts'),
      join(hooksDir, 'link.ts'),
    );

    const result = await loadUserHooks(hooksDir, catalog);

    // `readdir({withFileTypes:true})` reports lstat semantics, so the link
    // answered `isSymbolicLink()`, never `isFile()`, and was dropped before
    // `isHookFile` ran: no diagnostic, and not even counted in `fileCount`.
    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(2);
    expect(await compose(result, firstTransactionId())).toBe('linkedlinked');
  });

  it('reports a symlink that points at nothing', async () => {
    const hooksDir = await writeHooks({ 'a.ts': tagging(selectorA, 'a') });

    await symlink(join(hooksDir, 'gone.ts'), join(hooksDir, 'dangling.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('dangling.ts');
    expect(errorsOf(result).join('\n')).toContain('symbolic link');
    // The healthy file next to it still bound.
    expect(await compose(result, firstTransactionId())).toBe('a');
  });
});
