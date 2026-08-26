import {
  chmod,
  link,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { type HttpRequestTemplate, ThymianBaseError } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterAll, describe, expect, it } from 'vitest';

import {
  hookCreationLog,
  registerHook,
} from '../src/hooks/hook-registration.js';
import {
  describeTarget,
  fileIdentityFrom,
  hookResolutionError,
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

/** The `file` label of every per-hook diagnostic, in order, deduplicated. */
function filesOf(result: LoadUserHooksResult): string[] {
  return [
    ...new Set(
      result.diagnostics
        .filter((diagnostic) => diagnostic.kind !== undefined)
        .map((diagnostic) => diagnostic.file),
    ),
  ];
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

  it('skips a declaration file whose `.d.` is capitalised', () => {
    // The keep pattern matches `types.D.ts` — it does end in `.ts` — while a
    // case-sensitive exclusion missed it, so a hand-written declaration file was
    // handed to jiti and its `declare module` syntax drew a spurious "could not
    // be imported" error that failed the whole run.
    for (const name of ['types.D.ts', 'types.D.MTS'.toLowerCase(), 'a.D.cts']) {
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
      'B.ts': tagging(selectorA, 'B'),
      'nested/b.ts': tagging(selectorA, 'b'),
      'nested/deep/c.ts': tagging(selectorA, 'c'),
      '.eslintrc.ts': tagging(selectorA, 'dot'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(5);
    // "." (0x2E) sorts before "B" (0x42) sorts before "a" (0x61); "a.ts" before
    // "nested/...".
    //
    // `B.ts` next to `a.ts` is the pair that makes this an AC 2 test rather than
    // a walk test. AC 2 is *about* cross-platform determinism, and swapping
    // `compareKeys` for `a.localeCompare(b)` — the exact regression the comparator
    // exists to prevent, since `localeCompare` without an explicit locale reads
    // the host locale and the host ICU build — used to leave the whole suite
    // green: the old fixture keys ordered identically under both comparators.
    // Under `localeCompare` this composes `dotaBbc`.
    expect(await compose(result, firstTransactionId())).toBe('dotBabc');
  });

  it('labels a diagnostic with the hooks-dir-relative, `/`-joined path', async () => {
    // The documented `file` contract: relative to the hooks dir, never absolute,
    // and `/`-joined on every platform. The `\\` → `/` normalization in
    // `hooksDirRelative` is a no-op on POSIX, so this pins the relative-and-
    // joined half everywhere and the whole contract on the Windows CI leg.
    const hooksDir = await writeHooks({
      'nested/deep/c.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const gone = beforeEach('GET /renamed -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.diagnostics[0]?.file).toBe('nested/deep/c.ts');
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
    // The failing element is named by `exportName`, and — since round 4 — is
    // rendered into the aggregated error line too. Before that, `exportName` was
    // dropped by `formatDiagnostic`, so two exports of one file failing for the
    // same reason printed byte-identical lines and the user could not tell which
    // to fix.
    expect(
      result.diagnostics.find((d) => d.severity === 'error')?.exportName,
    ).toBe('list[1]');
    expect(hookResolutionError(result.diagnostics).message).toContain(
      'export "list[1]"',
    );
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

  it('sorts a branded value with a non-numeric `order` last, not first', async () => {
    // `snapshotRegistration` maps a non-numeric `order` to
    // `Number.MAX_SAFE_INTEGER`. It can only come from a hand-rolled or
    // version-skewed branded value, and putting an unknown creation index
    // *ahead* of the hooks the user really did author would silently change
    // their composition order. Changing that constant to `0` inverts the rule,
    // and nothing in the suite used to notice.
    const hooksDir = await writeHooks({
      'mixed.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const handRolled = {`,
        `  kind: 'beforeEach',`,
        `  order: 'not-a-number',`,
        `  target: ${JSON.stringify(selectorA)},`,
        `  callback: async (value) => ({ ...value, path: value.path + 'X' }),`,
        `  [${BRAND}]: true,`,
        `};`,
        `export const authored = beforeEach(${JSON.stringify(selectorA)}, async (value) => ({`,
        `  ...value,`,
        `  path: value.path + 'r',`,
        `}));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    // `handRolled` is collected first (namespace key order) but composes last.
    expect(await compose(result, firstTransactionId())).toBe('rX');
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

/**
 * Which extensions jiti transpiles, and which it hands to Node's own loader.
 *
 * This is the boundary of deferred issue #726, and it is the dimension both
 * existing freshness tests fail to vary: they use `.ts` only. jiti 2.6.1 decides
 * with `forceTranspile ?? (!isCjsExt && !(isEsm && async) && (isTs || isEsm ||
 * isTransformRe || hasESMSyntax(source)))`, and this loader passes `async: true`
 * — so `.cjs`, `.mjs` and a `.js` in a `"type": "module"` package all go native,
 * whatever their syntax, and land in Node's ESM registry, which has no eviction
 * API. A native load that *fails* falls back to transpiling, which is why any
 * file that resolves `@thymian/hooks` (a jiti-only alias Node cannot see) is
 * always fresh — and therefore why a stale module can never *declare* a hook.
 *
 * It can still *determine* one. The stale cases below supply the hook's target
 * from a helper module, which is the residue the story used to record as
 * harmless.
 *
 * **When #726 closes, invert the `stale: true` expectations — do not delete
 * them.** They are the only thing that will notice.
 */
describe('loadUserHooks — the transpile/native boundary (#726)', () => {
  const helperCases: {
    name: string;
    ext: string;
    stale: boolean;
    source: (selector: string) => string;
    packageJson?: string;
  }[] = [
    {
      name: 'a .ts helper is re-read',
      ext: 'ts',
      stale: false,
      source: (selector) => `export const SEL = ${JSON.stringify(selector)};\n`,
    },
    {
      name: 'a .js helper with ESM syntax in a CJS package is re-read',
      ext: 'js',
      stale: false,
      source: (selector) => `export const SEL = ${JSON.stringify(selector)};\n`,
    },
    {
      name: 'a .mjs helper is NOT re-read',
      ext: 'mjs',
      stale: true,
      source: (selector) => `export const SEL = ${JSON.stringify(selector)};\n`,
    },
    {
      name: 'a .cjs helper is NOT re-read',
      ext: 'cjs',
      stale: true,
      source: (selector) =>
        `module.exports = { SEL: ${JSON.stringify(selector)} };\n`,
    },
    {
      name: 'a .js helper in a "type": "module" package is NOT re-read',
      ext: 'js',
      stale: true,
      packageJson: '{"type":"module"}\n',
      source: (selector) => `export const SEL = ${JSON.stringify(selector)};\n`,
    },
  ];

  it.each(helperCases)('$name', async ({ ext, stale, source, packageJson }) => {
    const specifier = `./sel.${ext === 'ts' ? 'js' : ext}`;
    const hook = [
      `import { beforeEach } from '@thymian/hooks';`,
      `import { SEL } from '${specifier}';`,
      `export const h = beforeEach(SEL, async (v) => v);`,
      ``,
    ].join('\n');

    const hooksDir = await writeHooks({
      [`sel.${ext}`]: source(selectorA),
      'a.ts': hook,
      ...(packageJson ? { 'package.json': packageJson } : {}),
    });

    const first = await loadUserHooks(hooksDir, catalog);
    expect(anchorsOf(first)).toEqual([`"${selectorA}"`]);

    await writeFile(join(hooksDir, `sel.${ext}`), source(selectorB), 'utf-8');

    const second = await loadUserHooks(hooksDir, catalog);

    // A helper module never declares a hook, but it decides where one binds.
    expect(anchorsOf(second)).toEqual([`"${stale ? selectorA : selectorB}"`]);
  });

  it.each([
    [
      '.mjs',
      'a.mjs',
      (s: string) =>
        [
          `import { beforeEach } from '@thymian/hooks';`,
          `export const h = beforeEach(${JSON.stringify(s)}, async (v) => v);`,
          ``,
        ].join('\n'),
    ],
    [
      '.cjs',
      'a.cjs',
      (s: string) =>
        [
          `const { beforeEach } = require('@thymian/hooks');`,
          `module.exports.h = beforeEach(${JSON.stringify(s)}, async (v) => v);`,
          ``,
        ].join('\n'),
    ],
  ])(
    'a %s hook file that resolves @thymian/hooks is always re-read',
    async (_ext, name, source) => {
      // The half of the residue that IS closed: the native load cannot resolve
      // the bare `@thymian/hooks` specifier — that alias exists only on jiti's
      // transpile path — so it throws and jiti falls back to transpiling. A file
      // that creates a registration therefore never goes stale.
      const hooksDir = await writeHooks({ [name]: source(selectorA) });

      const first = await loadUserHooks(hooksDir, catalog);
      expect(anchorsOf(first)).toEqual([`"${selectorA}"`]);

      await writeFile(join(hooksDir, name), source(selectorB), 'utf-8');

      const second = await loadUserHooks(hooksDir, catalog);

      expect(anchorsOf(second)).toEqual([`"${selectorB}"`]);
    },
  );
});

// `symlink()` throws EPERM on Windows without Developer Mode, so the suite is
// skipped where it cannot be staged rather than hard-failing the CI leg that
// `compareKeys`'s docblock says AC 2 exists for.
const canSymlink = process.platform !== 'win32';

describe.skipIf(!canSymlink)('loadUserHooks — symlinked hook files', () => {
  it('loads a hook file whose only path into the scan is a symlink', async () => {
    // The target lives **outside** the hooks directory, so the link is the only
    // way in: `fileCount` here is 0 unless symlinked files are followed.
    // `readdir({withFileTypes:true})` reports lstat semantics, so the link
    // answers `isSymbolicLink()`, never `isFile()`, and was dropped before
    // `isHookFile` ran: no diagnostic, and not even counted in `fileCount`.
    const hooksDir = await writeHooks({});
    const outside = join(hooksDir, '..', 'shared-hook.ts');
    await writeFile(outside, tagging(selectorA, 'outside'), 'utf-8');

    await symlink(outside, join(hooksDir, 'link.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(1);
    expect(filesOf(result)).toEqual(['link.ts']);
    expect(await compose(result, firstTransactionId())).toBe('outside');
  });

  it('evaluates a symlinked hook file once when its target is also scanned', async () => {
    const hooksDir = await writeHooks({
      'real/target.ts': tagging(selectorA, 'linked'),
    });

    await symlink(
      join(hooksDir, 'real', 'target.ts'),
      join(hooksDir, 'link.ts'),
    );

    const result = await loadUserHooks(hooksDir, catalog);

    // One authored hook, reachable under two spellings. Keying the scan cache
    // on the link spelling evaluated it **twice**, so the single `beforeEach`
    // composed twice and the request path came back `'linkedlinked'`.
    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(1);
    expect(result.boundHookCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('linked');
    // The **real file** wins the attribution, even though `link.ts` sorts first.
    // Plain sort order used to hand it to the link, and a diagnostic naming
    // `link.ts` sends the reader to a symlink rather than to the code that
    // broke. Sort order still decides between two equally-real spellings; a link
    // simply never outranks its own target.
    //
    // This assertion does not discriminate "followed and deduped" from "dropped
    // the symlink" — both would name `real/target.ts` — and it does not need to:
    // that links are followed at all is pinned by the case above, where the
    // target lives outside the hooks directory and the link is the only spelling
    // the scan can reach.
    expect(filesOf(result)).toEqual(['real/target.ts']);
  });

  it('does not let a symlinked defineSample conflict with itself', async () => {
    const hooksDir = await writeHooks({
      'real.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `export const s = defineSample(${JSON.stringify(selectorA)}, () => ({}));`,
        ``,
      ].join('\n'),
    });

    await symlink(join(hooksDir, 'real.ts'), join(hooksDir, 'alias.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    // Two evaluations produced two distinct registration objects for one
    // authored hook, so the set-once check named the hook as its own rival —
    // `that transaction's sample is already set by "s" in "alias.ts"` — and
    // blocked the run with nothing the user could fix.
    expect(errorsOf(result)).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(result.boundHookCount).toBe(1);
    expect(result.sampleDefinitions.size).toBe(1);
  });

  it('collapses two symlinks that point at one file', async () => {
    const hooksDir = await writeHooks({});
    const outside = join(hooksDir, '..', 'shared-hook.ts');
    await writeFile(outside, tagging(selectorA, 'once'), 'utf-8');

    await symlink(outside, join(hooksDir, 'a-link.ts'));
    await symlink(outside, join(hooksDir, 'b-link.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(1);
    expect(filesOf(result)).toEqual(['a-link.ts']);
    expect(await compose(result, firstTransactionId())).toBe('once');
  });

  it('reports a broken symlinked file once, not once per spelling', async () => {
    // Round 2 recorded the reason as "a module that throws leaves no cache
    // entry". That is **false** — jiti writes the entry before running the body,
    // so a throw leaves one behind with `loaded: false` (measured directly).
    //
    // The real reason is that the two spellings are keyed differently: without
    // the realpath dedupe the second spelling misses the cache entirely and is
    // evaluated again, so the user reads the same failure twice under two names.
    // Since round 4 an entry that never finished is refused rather than served
    // (see `evaluateModule`), which is why the *first* spelling's failure is
    // still reported exactly once here rather than being swallowed.
    const hooksDir = await writeHooks({
      'real.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `throw new Error('module scope explodes');`,
        ``,
      ].join('\n'),
    });

    await symlink(join(hooksDir, 'real.ts'), join(hooksDir, 'alias.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('module scope explodes');
  });

  it('follows a chain of symlinks to one evaluation', async () => {
    const hooksDir = await writeHooks({
      'real/target.ts': tagging(selectorA, 'chained'),
    });

    await symlink(
      join(hooksDir, 'real', 'target.ts'),
      join(hooksDir, 'middle.ts'),
    );
    await symlink(join(hooksDir, 'middle.ts'), join(hooksDir, 'front.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('chained');
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

describe('loadUserHooks — round 4: the last unguarded reads', () => {
  it('survives an export that is a revoked Proxy, and keeps both siblings', async () => {
    // `if (Array.isArray(value))` sat outside every `try` — the last unguarded
    // user-value read on the collection path. `Array.isArray` does not answer
    // `false` for a revoked Proxy, it throws
    // (`TypeError: Cannot perform 'IsArray' on a proxy that has been revoked`),
    // so the whole scan died: no result, no diagnostic, no `file:` attribution,
    // and the two healthy files never bound.
    //
    // A **named** export is required: `export default r.proxy` is caught earlier
    // by jiti's own interop.
    const hooksDir = await writeHooks({
      'a-fine.ts': tagging(selectorA, 'A'),
      'b-revoked.ts': [
        `const revocable = Proxy.revocable([], {});`,
        `revocable.revoke();`,
        `export const bad = revocable.proxy;`,
        ``,
      ].join('\n'),
      'c-also-fine.ts': tagging(selectorA, 'C'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('b-revoked.ts');
    expect(errorsOf(result).join('\n')).toContain('could not be inspected');
    // AC 6: one broken file must not hide the other nine.
    expect(await compose(result, firstTransactionId())).toBe('AC');
  });

  it('survives a thrown error whose `message` getter throws', async () => {
    // Every `catch` in the loader funnels through `messageOf`, which read
    // `error.message` bare. `instanceof Error` is not protection: it narrows the
    // *type*, so the read compiles, while the value behind it is still whatever
    // the user threw. The read that exists to report a failure threw a second
    // failure straight out of the catch block that called it.
    const hooksDir = await writeHooks({
      'a-bad.ts': [
        `throw new Proxy(new Error('never seen'), {`,
        `  get(target, key, receiver) {`,
        `    if (key === 'message') { throw new Error('message getter exploded'); }`,
        `    return Reflect.get(target, key, receiver);`,
        `  },`,
        `});`,
        ``,
      ].join('\n'),
      'b-good.ts': tagging(selectorA, 'good'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('a-bad.ts');
    // `Error.prototype.toString` reads the same getter, so the honest answer is
    // the placeholder rather than a message the loader could not obtain.
    expect(errorsOf(result).join('\n')).toContain('[unprintable value]');
    expect(await compose(result, firstTransactionId())).toBe('good');
  });

  it('refuses a cached module that threw mid-body instead of serving it', async () => {
    // jiti writes `cache[filename] = module` **before** running the body and
    // sets `loaded = true` only on success, so a module that throws leaves an
    // entry holding whatever it assigned first. Round 2 recorded the opposite
    // ("a module that throws leaves no cache entry"); measured against jiti
    // 2.6.1, the key is present after the throw, with `loaded: false`.
    //
    // The silent form is the dangerous one: `a.ts` swallows the import error, so
    // nothing reports it, and the cache hit on `b.ts` then served the partial
    // namespace as healthy — `hasErrors: false`, and the hook from the module
    // that threw actually ran.
    const hooksDir = await writeHooks({
      'a-importer.ts': [
        `try {`,
        `  await import('./b-broken.js');`,
        `} catch {`,
        `  // swallowed, exactly like an optional-dependency probe`,
        `}`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
      'b-broken.ts': [
        tagging(selectorA, 'B').trimEnd(),
        `throw new Error('b exploded after exporting');`,
        ``,
      ].join('\n'),
      'c-healthy.ts': tagging(selectorA, 'C'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('b-broken.ts');
    expect(errorsOf(result).join('\n')).toContain('threw while being imported');
    // The hook from the module that threw must not bind, let alone run.
    expect(await compose(result, firstTransactionId())).not.toContain('B');
    expect(await compose(result, firstTransactionId())).toBe('C');
  });

  it('treats two hard links to one file as one hook', async (context) => {
    // The dedupe needs an inode the filesystem actually reports; where it does
    // not (`ino: 0`, documented for some Windows filesystems), the identity
    // falls back to the path and the two spellings stay separate by design. The
    // assertion below is about the inode path, so it is staged only where that
    // path exists rather than asserted against a documented non-guarantee.
    //
    // `context.skip()`, not a bare `return`: Vitest reports a returning test as
    // **passed**, so on Windows this looked green while asserting nothing.
    const probe = await writeHooks({ 'probe.ts': 'export const x = 1;\n' });

    await link(join(probe, 'probe.ts'), join(probe, 'probe-link.ts'));

    const info = await stat(join(probe, 'probe.ts'), { bigint: true });

    if (info.ino === 0n || info.nlink < 2n) {
      context.skip();
    }

    // `realpath` resolves symlinks, not hard links: two directory entries naming
    // one inode keep two distinct real paths, so the round-2 dedupe saw two
    // files, evaluated the module twice and composed one authored `beforeEach`
    // twice — the `'linkedlinked'` symptom in a different filesystem primitive,
    // and this time with `hasErrors: false` so nothing made it visible.
    const hooksDir = await writeHooks({ 'real.ts': tagging(selectorA, 'H') });

    await link(join(hooksDir, 'real.ts'), join(hooksDir, 'copy.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.fileCount).toBe(1);
    expect(result.boundHookCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('H');
  });

  // `chmod 000` does not stop a root user and means nothing for a directory on
  // Windows, so the case is skipped where it cannot be staged rather than
  // asserted vacuously — the same guard `samples-tree-guard.test.ts` uses.
  const canRefuseReads =
    process.platform !== 'win32' && process.getuid?.() !== 0;

  it.skipIf(!canRefuseReads)(
    'keeps the healthy tree when one subdirectory cannot be read',
    async () => {
      // `readdir({recursive: true})` is a single call, so an `EACCES` on any
      // nested directory rejected the whole walk and the guard above it returned
      // an empty result: `fileCount: 0`, every healthy hook in the tree lost, and
      // a message naming the **root** hooks directory as the thing that could not
      // be read. That is AC 6 at directory granularity.
      const hooksDir = await writeHooks({
        'good/a.ts': tagging(selectorA, 'good'),
        'locked/b.ts': tagging(selectorA, 'locked'),
      });

      await chmod(join(hooksDir, 'locked'), 0o000);

      try {
        const result = await loadUserHooks(hooksDir, catalog);

        expect(result.fileCount).toBe(1);
        expect(result.hasErrors).toBe(true);
        expect(errorsOf(result).join('\n')).toContain('locked');
        expect(errorsOf(result).join('\n')).toContain(
          'this directory could not be read',
        );
        // The whole point: the healthy sibling still bound.
        expect(await compose(result, firstTransactionId())).toBe('good');
      } finally {
        await chmod(join(hooksDir, 'locked'), 0o755);
      }
    },
  );

  it('reports an unenumerable namespace once, not twice and contradictorily', async () => {
    // The `Object.keys` catch pushed its diagnostic but never set the
    // exports-unusable flag, so `reportUnexportedRegistrations` did not skip the
    // file and added a second error telling the user to export a registration
    // they may well have exported. Nothing about this file's export surface is
    // knowable, so the second claim cannot be made honestly.
    const hooksDir = await writeHooks({
      'ns.cts': [
        `const { beforeEach } = require('@thymian/hooks');`,
        `const hook = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `module.exports = new Proxy({ hook }, {`,
        `  ownKeys() { throw new Error('ownKeys exploded'); },`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('ownKeys exploded');
    expect(errorsOf(result).join('\n')).not.toContain('not exported by any');
    expect(errorsOf(result)).toHaveLength(1);
  });

  it('renders two identically-failing exports of one file as distinct lines', async () => {
    // `formatDiagnostic` dropped `exportName`, so two exports failing for the
    // same reason printed byte-identical lines in the aggregated error and the
    // user could not tell which to fix.
    const hooksDir = await writeHooks({
      'two.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const first = beforeEach('get /nope', async (v) => v);`,
        `export const second = beforeEach('get /nope', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const lines = hookResolutionError(result.diagnostics)
      .message.split('\n')
      .filter((line) => line.includes('two.ts'));

    expect(lines).toHaveLength(2);
    expect(new Set(lines).size).toBe(2);
    expect(lines.join('\n')).toContain('export "first"');
    expect(lines.join('\n')).toContain('export "second"');
  });

  it('strips the control characters `\\s` does not match', async () => {
    // Round 2's whitespace collapse closed the newline case, but JavaScript's
    // `\s` matches neither ESC (U+001B) nor NEL (U+0085) — so a selector
    // carrying either still rewrote the terminal in the middle of the
    // aggregated list.
    const esc = String.fromCodePoint(0x1b);
    const nel = String.fromCodePoint(0x85);
    const hooksDir = await writeHooks({
      'esc.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /a\\u001b[2Jb\\u0085c', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(message).not.toContain(esc);
    expect(message).not.toContain(nel);
    // Replaced with a space, not deleted: dropping the control would join the
    // text on either side into a token that was never in the user's file.
    expect(message).toContain('a [2Jb c');
  });
});

describe('loadUserHooks — round 4b: what the round-4 review found still open', () => {
  it('reports a broken module that is only ever reached through an import', async () => {
    // The `loaded: false` refusal in `evaluateModule` only ever sees a module
    // the *scan* asks for. jiti's own nested resolution has no such check, so a
    // module that is not itself a hook file — here, under a dot-directory the
    // scan deliberately skips — never reached it. Measured before the fix:
    // `hasErrors: false`, and the hook from the module that threw composed into
    // the request.
    const hooksDir = await writeHooks({
      '.internal/broken.ts': [
        tagging(selectorA, 'BROKEN').trimEnd(),
        `throw new Error('broken exploded after exporting');`,
        ``,
      ].join('\n'),
      'a-swallows.ts': [
        `try {`,
        `  await import('./.internal/broken.js');`,
        `} catch {`,
        `  // swallowed`,
        `}`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
      'b-reexports.ts': [
        `export { hook } from './.internal/broken.js';`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('broken.ts');
    expect(errorsOf(result).join('\n')).toContain('never finished loading');

    // What changed is the **verdict**, and that is what stops the hook running:
    // `HookRunner.init` throws `hookResolutionError` whenever `hasErrors` is
    // set, before any request is dispatched, so nothing in `perTransaction` is
    // ever consulted. Before the fix this scan reported `hasErrors: false` and
    // the run proceeded with the hook composed in.
    //
    // The binding map is deliberately *not* asserted empty: the loader cannot
    // attribute a registration back to the module that created it — the
    // creation log records an import window, not a module — so refusing to bind
    // would mean discarding the healthy files' hooks too, which is the opposite
    // of AC 6.
    expect(() => hookResolutionError(result.diagnostics)).not.toThrow();
    expect(hookResolutionError(result.diagnostics).message).toContain(
      'broken.ts',
    );
  });

  it('names the broken module whichever side of it the importer sorts', async () => {
    // Attributing only to importers made the verdict depend on a filename: the
    // importer that sorted *before* the broken file was reported and the one
    // that sorted *after* it bound cleanly from the partial cache entry, so the
    // same tree got opposite verdicts. Reporting the **module** is what makes
    // the two orderings agree.
    //
    // The import is swallowed on both sides, so only the end-of-scan sweep can
    // report it. Before the fix the two orderings disagreed: the importer that
    // ran first was handed a false "created but not exported" for a registration
    // `m-broken.ts` really did export, and the one that ran last was not.
    const scan = async (importerName: string) =>
      await loadUserHooks(
        await writeHooks({
          [importerName]: [
            // Swallowed, so nothing but the sweep can report the failure. A
            // *static* import would propagate and fail the importer on its own,
            // which is honest and was never the defect.
            `try {`,
            `  await import('./m-broken.js');`,
            `} catch {`,
            `  // swallowed`,
            `}`,
            `export const nothing = 1;`,
            ``,
          ].join('\n'),
          'm-broken.ts': [
            tagging(selectorA, 'M').trimEnd(),
            `throw new Error('m exploded');`,
            ``,
          ].join('\n'),
        }),
        catalog,
      );

    const before = await scan('a-importer.ts');
    const after = await scan('z-importer.ts');

    for (const [label, result] of [
      ['importer sorts first', before],
      ['importer sorts last', after],
    ] as const) {
      expect(result.hasErrors, label).toBe(true);
      expect(errorsOf(result).join('\n'), label).toContain('m-broken.ts');
      // Neither ordering tells anyone to export something they never created.
      expect(errorsOf(result).join('\n'), label).not.toContain(
        'not exported by any',
      );
    }
  });

  it('does not blame the importer for a registration the broken module exported', async () => {
    // The registration was created inside the importer's import *window*, but
    // the window belongs to the importer whose own import succeeded — so the
    // per-file skip could never have caught it, and the diff told the user to
    // re-export something they had already exported.
    const hooksDir = await writeHooks({
      'a-importer.ts': [
        `try {`,
        `  await import('./b-broken.js');`,
        `} catch {`,
        `  // swallowed`,
        `}`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
      'b-broken.ts': [
        tagging(selectorA, 'B').trimEnd(),
        `throw new Error('b exploded after exporting');`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result).join('\n')).toContain('b-broken.ts');
    expect(errorsOf(result).join('\n')).not.toContain('not exported by any');
  });

  it('survives a hook file that poisons the shared creation log', async () => {
    // The log lives in a `globalThis` slot under a `Symbol.for` key — it has to,
    // or the plugin's realm and the hook file's realm would not share it — which
    // makes it user-writable. It was read unguarded, and the throw landed on the
    // *next* file, so one poisoning file killed every healthy sibling.
    const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

    for (const [name, poison] of [
      [
        'throwing getter',
        `${slot} = new Proxy({ nextOrder: 0, created: [] }, { get(t, k) { if (k === 'created') { throw new Error('created getter exploded'); } return Reflect.get(t, k); } });`,
      ],
      ['version skew, no hostility', `${slot} = { nextOrder: 0 };`],
      [
        'frozen log',
        `${slot} = Object.freeze({ nextOrder: 0, created: Object.freeze([]) });`,
      ],
    ] as const) {
      const hooksDir = await writeHooks({
        'a-poison.ts': [poison, `export const nothing = 1;`, ``].join('\n'),
        'b-good.ts': tagging(selectorA, 'good'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      // The healthy sibling still binds — the whole point of AC 6.
      expect(
        await compose(result, firstTransactionId()),
        `poison: ${name}`,
      ).toBe('good');
    }
  });

  it('does not lose a created-but-not-exported diagnostic to a concurrent scan', async () => {
    // The creation log is process-global and the scan drains it per file, so two
    // overlapping scans destroyed each other's in-flight list. Measured before
    // the fix: the scan whose hook file awaited came back with no
    // created-but-not-exported diagnostic at all — silently lost, not merely
    // mis-attributed. `HookRunner.init` and 575.10's `sampler validate` both
    // call the loader, in one process.
    const slow = await writeHooks({
      'slow.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        // Create FIRST, then await: the destructive window is between a
        // registration being logged and the scan that logged it draining the
        // log. Awaiting first put the creation after the other scan's drain,
        // which is why the ordering matters to the fixture.
        `beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `await new Promise((resolve) => setTimeout(resolve, 60));`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });
    const other = await writeHooks({ 'other.ts': tagging(selectorB, 'other') });

    const [slowResult, otherResult] = await Promise.all([
      loadUserHooks(slow, catalog),
      loadUserHooks(other, catalog),
    ]);

    expect(errorsOf(slowResult).join('\n')).toContain('not exported by any');
    expect(errorsOf(otherResult)).toEqual([]);
  });

  it('binds nothing and says so for a negative or fractional selector-list length', async () => {
    // `asFiniteNumber` accepts negatives and fractions and the guard was
    // `=== 0`, so a `length` of `-1` reported `boundHookCount: 1`,
    // `hasErrors: false` and a hook that never fires — the exact outcome the
    // empty-list branch exists to prevent. A fractional length produced
    // "1 of 0.5 selector(s) do not resolve".
    for (const length of [-1, 0.5]) {
      const hooksDir = await writeHooks({
        'neg.ts': [
          `import { beforeEach } from '@thymian/hooks';`,
          `const list = new Proxy([${JSON.stringify(selectorA)}], {`,
          `  get(t, k, r) { if (k === 'length') { return ${length}; } return Reflect.get(t, k, r); },`,
          `});`,
          `export const h = beforeEach(list, async (v) => v);`,
          ``,
        ].join('\n'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(result.hasErrors, `length ${length}`).toBe(true);
      expect(errorsOf(result).join('\n'), `length ${length}`).toContain(
        'can never run',
      );
    }
  });

  it('refuses a selector list longer than the cap rather than resolving it', async () => {
    // Deterministic, not a stopwatch: with the cap the loader examines the first
    // hundred, finds them all fine, and *says* the list is too long. Without it,
    // all five thousand resolve and the hook binds — so the two outcomes differ
    // in text, not merely in duration.
    const hooksDir = await writeHooks({
      'many.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const list = new Array(5000).fill(${JSON.stringify(selectorA)});`,
        `export const h = beforeEach(list, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('targets a list of 5000');
    expect(errorsOf(result).join('\n')).toContain('more than the 100');
    expect(result.boundHookCount).toBe(0);
  });

  it('caps the rendering of an enormous selector list instead of building it', async () => {
    // No Proxy needed: a plain sparse array reaches this. Measured before the
    // cap, `length = 200000` produced a 2.6 MB anchor and a 12.8 MB reason —
    // 15.4 MB in one `ThymianBaseError.message` — and `length = 1e7` exhausted
    // memory, inside a function contracted never to throw for user error.
    const hooksDir = await writeHooks({
      'huge.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const list = [];`,
        `list.length = 200000;`,
        `export const h = beforeEach(list, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const started = Date.now();
    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(result.hasErrors).toBe(true);
    expect(message.length).toBeLessThan(8_000);
    expect(message).toContain('more');
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('names a primitive target instead of blaming the filter matcher', async () => {
    // A number, boolean, null, Symbol or BigInt is neither a selector nor a
    // selector list, and `TransactionFilter` is documented as an object — so
    // these fell through to the filter branch and the user was told their filter
    // matched nothing, which says nothing about the actual mistake.
    for (const literal of ['42', 'true', 'null', "Symbol('s')", '1n']) {
      const hooksDir = await writeHooks({
        'prim.ts': [
          `import { beforeEach } from '@thymian/hooks';`,
          `export const h = beforeEach(${literal}, async (v) => v);`,
          ``,
        ].join('\n'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(result.hasErrors, literal).toBe(true);
      expect(errorsOf(result).join('\n'), literal).not.toContain(
        'matched none of',
      );
      expect(errorsOf(result).join('\n'), literal).toContain(
        'is not a selector',
      );
    }
  });

  it('keeps zero-width joiners that cannot move a cursor', async () => {
    // `\\p{Cf}` was far wider than the stated threat. It also contains ZWJ and
    // ZWNJ, so it split an emoji family sequence into three glyphs and turned a
    // Persian ZWNJ into a space — changing the selector the message quotes into
    // one that is not in the user's file, while `diagnostic.anchor` kept the
    // original. Nothing about a joiner rewrites a terminal.
    const hooksDir = await writeHooks({
      'zwj.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /\\u{1F468}\\u200D\\u{1F469}/mi\\u200Cshavad', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(message).toContain('‍');
    expect(message).toContain('‌');
  });

  it('sanitizes suggestions, not only the diagnostic line', async () => {
    // `sanitizeLine`'s docblock claimed to be "everything that has to be true of
    // a rendered line, in one place", but `hookResolutionError` builds the
    // suggestion list on a separate path that never reached it, so ESC and a
    // newline from a user-supplied suggestion went straight to the terminal.
    const hostileCatalog = {
      size: 1,
      entries: () => [],
      resolve: () => {
        throw new ThymianBaseError('nope', {
          name: 'SelectorNotFoundError',
          suggestions: ['bad[2Jsuggestion\nsecond line'],
        });
      },
      tryResolve: () => undefined,
      selectors: () => [],
    } as unknown as TransactionCatalog;

    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, hostileCatalog);
    const suggestions =
      hookResolutionError(result.diagnostics).options.suggestions ?? [];

    expect(suggestions.join('\n')).not.toContain('');
    expect(suggestions.join('\n')).not.toContain('\n');
  });

  it('does not collapse two files that merely share a reported inode', async () => {
    // `dev:ino` is only trustworthy as an identity when the entry can actually
    // BE a hard link. Some FUSE, SMB and Docker volume drivers report a constant
    // or colliding non-zero inode, and collapsing on that dropped nine hooks in
    // ten with no diagnostic and `hasErrors: false` — a worse failure, because
    // silent, than the double-evaluation the dedupe exists to prevent.
    // `nlink > 1` is what proves an entry is a hard link.
    const hooksDir = await writeHooks({
      'a.ts': tagging(selectorA, 'A'),
      'b.ts': tagging(selectorA, 'B'),
      'c.ts': tagging(selectorA, 'C'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.fileCount).toBe(3);
    expect(await compose(result, firstTransactionId())).toBe('ABC');
  });

  it('reports a symbolic link that points at a directory', async () => {
    // The adjacent branch treats a dangling link as "nothing happened is the
    // wrong answer" and says so; a link to a directory got the silent treatment
    // that comment argues against — no diagnostic, not even counted.
    const hooksDir = await writeHooks({ 'a.ts': tagging(selectorA, 'a') });

    await mkdir(join(hooksDir, 'target-dir'), { recursive: true });
    await symlink(join(hooksDir, 'target-dir'), join(hooksDir, 'dir-link.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('dir-link.ts');
    expect(errorsOf(result).join('\n')).toContain('directory');
    expect(await compose(result, firstTransactionId())).toBe('a');
  });

  it('attributes a deduped pair to the real file, not to the symlink', async () => {
    // "First key in sort order wins" handed the attribution to a link named
    // `aaa-link.ts` pointing at `zzz-real.ts`, so the diagnostic sent the user to
    // a file containing a symlink rather than to the code that broke.
    const hooksDir = await writeHooks({
      'zzz-real.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /nope', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    await symlink(join(hooksDir, 'zzz-real.ts'), join(hooksDir, 'aaa-link.ts'));

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.fileCount).toBe(1);
    expect(errorsOf(result).join('\n')).toContain('zzz-real.ts');
    expect(errorsOf(result).join('\n')).not.toContain('aaa-link.ts');
  });

  it('enumerates nothing for a namespace that is a primitive string', async () => {
    // `module.exports = 'abcdef'` makes jiti hand back the primitive itself, and
    // `Object.keys` on a string yields one key per character — so a 5 MB string
    // became 5 million guarded property reads. A string has no exports.
    const hooksDir = await writeHooks({
      'str.cts': [`module.exports = 'abcdefghij'.repeat(1000);`, ``].join('\n'),
      'good.ts': tagging(selectorA, 'good'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await compose(result, firstTransactionId())).toBe('good');
  });

  it('reports one conflict per rival, not one per transaction it covers', async () => {
    // `conflict()` called `describeTarget` again for every conflicting id, so a
    // two-selector overlap rendered the user's target twice more and printed two
    // byte-identical error lines; a 240-selector list printed 240.
    const hooksDir = await writeHooks({
      'dup.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `const both = [${JSON.stringify(selectorA)}, ${JSON.stringify(selectorB)}];`,
        `export const first = defineSample(both, () => ({}));`,
        `export const second = defineSample(both, () => ({}));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('already set by');
  });

  it('refuses to build an error out of a diagnostics array with no errors', async () => {
    // `hookResolutionError([])` rendered "0 sampler hook problem(s) must be
    // fixed before a test run can start:" followed by nothing. `HookRunner.init`
    // gates on `hasErrors`, but the function is exported and 575.10's
    // `sampler validate` renders the same array.
    expect(() => hookResolutionError([])).toThrow(/no error diagnostics/);
    expect(() =>
      hookResolutionError([
        { severity: 'info', file: 'a.ts', reason: 'resolved to 1' },
      ]),
    ).toThrow(/no error diagnostics/);
  });
});

describe('loadUserHooks — round 4b: the gaps the mutation run exposed', () => {
  it('keys identity on the inode only when the entry can be a hard link', () => {
    // Not reachable through the filesystem: no real filesystem reports the same
    // inode for two distinct files, which is exactly why an unconditional
    // `dev:ino` was dangerous — several FUSE, SMB and Docker volume drivers do
    // report a constant or colliding inode, and every hook file then collapsed
    // to one identity and nine in ten vanished with `hasErrors: false`.
    const linked = { dev: 1n, ino: 42n, nlink: 2n };
    const lone = { dev: 1n, ino: 42n, nlink: 1n };

    // Two spellings of one hard-linked file share an identity.
    expect(fileIdentityFrom('/x/a.ts', linked)).toBe(
      fileIdentityFrom('/x/b.ts', linked),
    );

    // Two files that merely report the same inode do not.
    expect(fileIdentityFrom('/x/a.ts', lone)).not.toBe(
      fileIdentityFrom('/x/b.ts', lone),
    );

    // `ino: 0` (documented for some Windows filesystems) falls back to the path.
    expect(fileIdentityFrom('/x/a.ts', { dev: 1n, ino: 0n, nlink: 2n })).toBe(
      fileIdentityFrom('/x/a.ts', undefined),
    );

    // The two schemes are tagged, so a path identity can never collide with an
    // inode one across a failed `stat`.
    expect(fileIdentityFrom('/x/a.ts', undefined)).not.toBe(
      fileIdentityFrom('/x/a.ts', linked),
    );
  });

  it('reads no more of a selector list than the cap allows', () => {
    // The cap is a *time* bound, and a size assertion cannot see it: the quoted
    // failures are capped separately, so removing this one changed only how long
    // the scan spun. Counting the reads is what makes it observable.
    let reads = 0;
    const target = new Proxy([] as unknown[], {
      get(t, key, receiver) {
        if (key === 'length') {
          return 5000;
        }

        if (typeof key === 'string' && /^\d+$/.test(key)) {
          reads += 1;

          return 'get /never-resolves';
        }

        return Reflect.get(t, key, receiver);
      },
    });

    expect(describeTarget(target as unknown as readonly string[])).toContain(
      'more',
    );
    // One pass of at most the cap, not 5000.
    expect(reads).toBeLessThanOrEqual(120);
  });

  it('renders a fractional selector-list length as no elements at all', async () => {
    // `readLength`'s clamp is what `renderTarget` relies on: unclamped, a
    // `length` of `0.5` still satisfied `0 < 0.5` and rendered element zero, so
    // the anchor claimed a selector the list does not have.
    const hooksDir = await writeHooks({
      'frac.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const list = new Proxy([${JSON.stringify(selectorA)}], {`,
        `  get(t, k, r) { if (k === 'length') { return 0.5; } return Reflect.get(t, k, r); },`,
        `});`,
        `export const h = beforeEach(list, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(anchorsOf(result)).toContain('[]');
  });

  it('replaces a creation log whose `created` is not an array', async () => {
    // A version-skewed runtime that ships `created` as an object passes a
    // writability probe — objects take a `push` if one is defined, and this one
    // has one — so the shape check is the part that catches it. Without both,
    // the loader drains something that is not a list.
    const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;
    const hooksDir = await writeHooks({
      'a-skew.ts': [
        `${slot} = { nextOrder: 0, created: { push() {}, length: 0 } };`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
      'b-good.ts': tagging(selectorA, 'good'),
      'c-unexported.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorB)}, async (v) => v);`,
        `export const nothing = 2;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(await compose(result, firstTransactionId())).toBe('good');
    // Replaced, not merely tolerated. A guarded drain alone would swallow the
    // bad slot and keep swallowing it, so every later file's
    // created-but-not-exported diagnostic would be lost for the rest of the
    // process. Installing a fresh log is what keeps the channel working.
    expect(errorsOf(result).join('\n')).toContain('not exported by any');
  });

  it('enumerates a huge primitive namespace without walking it', async () => {
    // `Object.keys` on a primitive string yields one key per character, and each
    // one then costs a guarded property read, an `Array.isArray` and a brand
    // check. A string has no exports; asking is the whole cost.
    const hooksDir = await writeHooks({
      'str.cts': [`module.exports = 'abcdefghij'.repeat(1000000);`, ``].join(
        '\n',
      ),
      'good.ts': tagging(selectorA, 'good'),
    });

    const started = Date.now();
    const result = await loadUserHooks(hooksDir, catalog);
    const elapsed = Date.now() - started;

    expect(errorsOf(result)).toEqual([]);
    expect(await compose(result, firstTransactionId())).toBe('good');
    // Ten million characters. Answering "a string has no exports" is O(1);
    // enumerating it is ten million keys, each costing a guarded property read,
    // an `Array.isArray` and a brand check — measured at ~2.2 s against ~0.15 s.
    // The bound sits between the two, not near either.
    expect(elapsed, `${elapsed}ms`).toBeLessThan(1_200);
  });
});

describe('loadUserHooks — round 5: what the review of the review found', () => {
  it('does not let a hook file that never settles wedge any other scan', async () => {
    // Round 4b serialised scans on a module-global queue to stop two of them
    // destroying each other's creation log. That closed one hole and opened a
    // worse one: the queue chains on the previous scan's promise, so a hook file
    // that never settles — a top-level `await` that hangs, or a namespace that
    // is thenable and never resolves — left every later `loadUserHooks` in the
    // process waiting forever. A different plugin instance, a different
    // workspace, and 575.10's `sampler validate` were all dead with it.
    //
    // The queue is gone; collection is scoped per evaluation instead.
    const hanging = await writeHooks({
      'hang.ts': [`await new Promise(() => {});`, ``].join('\n'),
    });
    const healthy = await writeHooks({ 'a.ts': tagging(selectorA, 'fine') });

    // Deliberately not awaited: it never settles, which is the point.
    void loadUserHooks(hanging, catalog);

    const result = await Promise.race([
      loadUserHooks(healthy, catalog),
      new Promise<'timed-out'>((resolve) =>
        setTimeout(() => resolve('timed-out'), 3_000),
      ),
    ]);

    expect(result).not.toBe('timed-out');
    expect(
      await compose(result as LoadUserHooksResult, firstTransactionId()),
    ).toBe('fine');
  });

  it('attributes a creation to the scan that caused it, not to whichever is open', async () => {
    // A per-scan collector is not enough: two scans interleave at every `await`,
    // so a collector that is merely "open" also catches the other scan's
    // creations. Measured that way, an innocent file was told it had failed to
    // export a registration a concurrent scan had created. The collection scope
    // is an `AsyncLocalStorage` on the shared log, so a creation lands in
    // exactly one collector.
    const slow = await writeHooks({
      'slow.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `await new Promise((resolve) => setTimeout(resolve, 60));`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });
    const other = await writeHooks({ 'other.ts': tagging(selectorB, 'other') });

    const [slowResult, otherResult] = await Promise.all([
      loadUserHooks(slow, catalog),
      loadUserHooks(other, catalog),
    ]);

    // The scan that created it keeps its diagnostic …
    expect(errorsOf(slowResult).join('\n')).toContain('not exported by any');
    // … and the scan that merely overlapped it is not blamed.
    expect(errorsOf(otherResult)).toEqual([]);
  });

  it('keeps the exports of a namespace that is a function', async () => {
    // The guard added for a 10 M-character string namespace also swallowed
    // `typeof === 'function'`, so `module.exports = f; f.hook = beforeEach(…)`
    // lost its hook and was then told to export what it had exported.
    // `Object.keys` on a function returns its own enumerable string keys.
    const hooksDir = await writeHooks({
      'cjs-fn.cts': [
        `const { beforeEach } = require('@thymian/hooks');`,
        `function handler() {}`,
        `handler.hook = beforeEach(${JSON.stringify(selectorA)}, async (value) => ({`,
        `  ...value,`,
        `  path: value.path + 'fn',`,
        `}));`,
        `module.exports = handler;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.boundHookCount).toBe(1);
    expect(await compose(result, firstTransactionId())).toBe('fn');
  });

  it('does not call a module that is still loading a module that threw', async () => {
    // `loaded === false` means "started and has not finished", which is "threw"
    // only if evaluation actually settled. A non-awaited `import()` of a module
    // with a slow top-level await — an ordinary prefetch — was reported as
    // having thrown, in a sentence where every clause was false, and the run
    // refused to start. Worse, the verdict was timing-dependent: the same tree
    // passed when the module happened to finish first.
    const hooksDir = await writeHooks({
      '.internal/slow.ts': [
        `await new Promise((resolve) => setTimeout(resolve, 300));`,
        `export const ready = true;`,
        ``,
      ].join('\n'),
      'a-lazy.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const pending = import('./.internal/slow.js');`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (value) => {`,
        `  await pending;`,
        `  return { ...value, path: value.path + 'lazy' };`,
        `});`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(await compose(result, firstTransactionId())).toBe('lazy');
  });

  it('survives a creation log that is sealed, frozen or getter-only', async () => {
    // The previous validation proved writability by *calling* `created.push()`.
    // A zero-argument `push` only re-sets `length`, so it accepted a **sealed**
    // array that the real `push(value)` then rejects — and it never touched
    // `nextOrder` at all, so a frozen log object and a getter-only `nextOrder`
    // both sailed through and then failed every hook file in the scan.
    const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

    for (const [name, poison] of [
      [
        'sealed created',
        `${slot} = { nextOrder: 0, created: Object.seal([]) };`,
      ],
      [
        'frozen log object',
        `${slot} = Object.freeze({ nextOrder: 0, created: [] });`,
      ],
      [
        'getter-only nextOrder',
        `${slot} = { get nextOrder() { return 0; }, created: [] };`,
      ],
      [
        'frozen everything',
        `${slot} = Object.freeze({ nextOrder: 0, created: Object.freeze([]) });`,
      ],
    ] as const) {
      const hooksDir = await writeHooks({
        'a-poison.ts': [poison, `export const nothing = 1;`, ``].join('\n'),
        'b-good.ts': tagging(selectorA, 'good'),
        'c-also-good.ts': tagging(selectorA, 'C'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(errorsOf(result), `poison: ${name}`).toEqual([]);
      expect(await compose(result, firstTransactionId()), name).toBe('goodC');
    }
  });

  it('does not run user code to decide whether the creation log is usable', async () => {
    // The writability probe called `created.push()`. On a `created` carrying its
    // own `push`, that ran user code **and kept its side effects** — measured
    // appending junk entries that were then reported as created-but-not-exported
    // against an innocent, unrelated directory, for the lifetime of the process.
    const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;
    const poisoned = await writeHooks({
      'a-poison.ts': [
        `const created = [];`,
        `created.push = function () { Array.prototype.push.call(this, 'junk'); return this.length; };`,
        `${slot} = { nextOrder: 0, created };`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    await loadUserHooks(poisoned, catalog);

    // A completely unrelated, healthy directory afterwards.
    const healthy = await writeHooks({ 'good.ts': tagging(selectorA, 'good') });
    const result = await loadUserHooks(healthy, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await compose(result, firstTransactionId())).toBe('good');
  });

  it('does not blame the file whose exported array is over the cap', async () => {
    // The over-cap branch `continue`d without marking the file's exports
    // unusable, so the scan-wide diff then told the user to export the very
    // registrations it had just refused to read — the same contradictory pair
    // the enumeration branch was fixed to avoid, one branch over.
    const hooksDir = await writeHooks({
      'many.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const hooks = Array.from({ length: 101 }, () =>`,
        `  beforeEach(${JSON.stringify(selectorA)}, async (v) => v),`,
        `);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]).toContain('is an array of 101 values');
  });

  it('still reports a genuine missing export in a file next to a broken one', async () => {
    // The scan-wide bail was too wide: a file that imported perfectly and simply
    // forgot to export its hook had its diagnostic hidden by an unrelated
    // sibling's import failure. That is AC 6's sentence pointed the other way.
    // Only an *unfinished* module can contaminate another file's window; a file
    // that threw owns its own creations and is skipped by name.
    const hooksDir = await writeHooks({
      'a-broken.ts': [`throw new Error('boom');`, ``].join('\n'),
      'b-forgot-export.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const errors = errorsOf(result).join('\n');

    expect(errors).toContain('a-broken.ts');
    expect(errors).toContain('b-forgot-export.ts');
    expect(errors).toContain('not exported by any');
  });

  it('says how many selectors it actually checked', async () => {
    // "1 of 200 selector(s) do not resolve" claimed to have checked 200 when it
    // checked 100, so a second bad selector past the cap was silently omitted
    // from the count.
    const hooksDir = await writeHooks({
      'big.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const list = Array.from({ length: 200 }, () => ${JSON.stringify(selectorA)});`,
        `list[5] = 'not-a-selector';`,
        `export const h = beforeEach(list, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('only the first 100');
  });

  it('truncates a single enormous rendered value', async () => {
    // Capping the element *count* left the element *size* unbounded: one
    // five-million-character selector produced a ten-megabyte error message, and
    // a hundred hundred-thousand-character ones produced twelve.
    const hooksDir = await writeHooks({
      'huge.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /' + 'x'.repeat(500000), async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    // Bounded, not tiny. The value itself is capped at 200 characters; the
    // *message* carrying it gets `MAX_MESSAGE_LENGTH`, because jiti's parse
    // errors are tail-loaded and a 200-character cap cut the `file:line:column`
    // off the end of an ordinary nested path. Before any bound this was
    // 1,000,156 characters.
    expect(message.length).toBeLessThan(6_000);
    expect(message).toContain('…');
  });
  it('strips invisible tag characters from a rendered line', async () => {
    // The Unicode TAG block (U+E0000–U+E007F) does not move a cursor; it is
    // simply invisible, which makes it a way to put text a user cannot see into
    // a message they are being asked to trust.
    const tag = String.fromCodePoint(0xe0041);
    const hooksDir = await writeHooks({
      'tag.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /a\\u{E0041}b', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(message).not.toContain(tag);
  });
});

describe('loadUserHooks — round 6: the regressions round 5 introduced', () => {
  const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

  it('refuses a collection scope a hook file supplied', async () => {
    // The worst hole this story has had, and it was introduced by the fix for
    // the previous one. `isUsableCreationLog` is a type predicate that certifies
    // the whole `HookCreationLog` shape from a single descriptor check on
    // `nextOrder`, and `hookCreationLog` then kept whatever `scope` was there
    // because `??=` only replaces a nullish one. `withCreationScope` **calls**
    // it.
    //
    // One line in a hook file was therefore enough to make `loadUserHooks`
    // throw a `TypeError` out of itself — losing every healthy sibling — or, with
    // a `run` that returns a never-settling promise, to wedge every future scan
    // in the process permanently, because the slot outlives the scan. That is
    // strictly worse than the module-global queue this replaced.
    //
    // `instanceof AsyncLocalStorage` is reliable here because jiti shares Node's
    // builtins across the realm boundary.
    for (const [name, run] of [
      ['run returns undefined', `run() { return undefined; }`],
      ['run returns a non-promise', `run() { return 42; }`],
      ['run throws', `run() { throw new Error('scope exploded'); }`],
    ] as const) {
      const hooksDir = await writeHooks({
        'a-poison.ts': [
          `${slot} = { nextOrder: 0, created: [], scope: { ${run}, getStore() {} } };`,
          `export const nothing = 1;`,
          ``,
        ].join('\n'),
        'b-good.ts': tagging(selectorA, 'good'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(await compose(result, firstTransactionId()), name).toBe('good');
    }
  });

  it('is not wedged by a collection scope that never settles', async () => {
    // The same hole in its worse form: `run` returning a promise that never
    // resolves made every later `loadUserHooks` in the process hang forever.
    const poisoned = await writeHooks({
      'a-poison.ts': [
        `${slot} = { nextOrder: 0, created: [], scope: { run() { return new Promise(() => {}); }, getStore() {} } };`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    await Promise.race([
      loadUserHooks(poisoned, catalog),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);

    // A completely unrelated, healthy directory afterwards.
    const healthy = await writeHooks({ 'good.ts': tagging(selectorA, 'fine') });
    const outcome = await Promise.race([
      loadUserHooks(healthy, catalog),
      new Promise<'wedged'>((resolve) =>
        setTimeout(() => resolve('wedged'), 3_000),
      ),
    ]);

    expect(outcome).not.toBe('wedged');
    expect(
      await compose(outcome as LoadUserHooksResult, firstTransactionId()),
    ).toBe('fine');
  });

  it('still reports a hook exported only from a file the scan skips', async () => {
    // Excusing every module's exports was too wide. A hook exported from a
    // *healthy* module the scan does not visit — a dot-directory, a sibling
    // `lib/` — never binds, and suppressing its diagnostic left the user a hook
    // that silently never fires and no errors at all. Only a module that never
    // **finished** is one whose exports the user cannot be blamed for.
    const hooksDir = await writeHooks({
      '.internal/lib.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
      'a.ts': [
        `import './.internal/lib.js';`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('not exported by any');
    expect(result.boundHookCount).toBe(0);
  });

  it('keeps the actionable tail of a parse error', async () => {
    // `messageOf` shared the 200-character cap for rendered *values*. jiti's
    // `ParseError` is tail-loaded — the `file:line:column` comes last — so an
    // ordinary nested hooks path, with no hostile input at all, pushed the line
    // number off the end and left "Unexpected token" and a truncated path.
    const hooksDir = await writeHooks({
      'a/deeply/nested/set/of/hook/directories/like/a/real/project/has/broken.ts':
        [`export const oops = ;`, ``].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const errors = errorsOf(result).join('\n');

    expect(result.hasErrors).toBe(true);
    expect(errors).toContain('broken.ts');
  });

  it('bounds an export name as well as an export value', async () => {
    // The size bounds covered the value and not the name. Export names come from
    // `ownKeys` and are exactly as user-controlled.
    const hooksDir = await writeHooks({
      'longname.cts': [
        `const { beforeEach } = require('@thymian/hooks');`,
        `module.exports = { ['k'.repeat(300000)]: beforeEach('get /nope', async (v) => v) };`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(result.hasErrors).toBe(true);
    expect(message.length).toBeLessThan(10_000);
  });

  it('keeps the creation index rising when the log is replaced mid-scan', async () => {
    // `resetCreationLog` hands back `nextOrder: 0`, so re-stamping from the
    // fresh log restarted every later registration at zero — silently reordering
    // the composition the counter exists to fix, which is exactly what the retry
    // was written to avoid.
    const hooksDir = await writeHooks({
      'a.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const tag = (t) => async (value) => ({ ...value, path: value.path + t });`,
        `export const first = beforeEach(${JSON.stringify(selectorA)}, tag('1'));`,
        // Poison the slot between two creations in the same file: the next
        // `registerHook` write fails, resets, and must not restart the index.
        `${slot} = Object.freeze({ nextOrder: 5, created: [] });`,
        `export const second = beforeEach(${JSON.stringify(selectorA)}, tag('2'));`,
        `export const third = beforeEach(${JSON.stringify(selectorA)}, tag('3'));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await compose(result, firstTransactionId())).toBe('123');
  });
});

describe('loadUserHooks — round 6b: the edge-case layer', () => {
  const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

  it('survives a creation-log slot defined as a throwing getter', async () => {
    // The slot read had been moved *outside* the guard while refactoring, so
    // `Object.defineProperty(globalThis, key, { get() { throw … } })` threw an
    // unformatted TypeError straight out of `loadUserHooks` and killed the scan
    // with no `file:` attribution. Same shape as every other finding in this
    // story, in the one read that had drifted out of a `try`.
    const hooksDir = await writeHooks({
      'a-poison.ts': [
        `Object.defineProperty(globalThis, Symbol.for('@thymian/plugin-sampler.hook-creation-log'), {`,
        `  configurable: true,`,
        `  get() { throw new Error('slot getter boom'); },`,
        `  set() {},`,
        `});`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
      'b-good.ts': tagging(selectorA, 'good'),
    });

    let result: LoadUserHooksResult;

    try {
      result = await loadUserHooks(hooksDir, catalog);
    } finally {
      // The accessor is configurable, so the next test starts clean.
      Reflect.deleteProperty(
        globalThis,
        Symbol.for('@thymian/plugin-sampler.hook-creation-log'),
      );
    }

    expect(await compose(result, firstTransactionId())).toBe('good');
  });

  it('rejects a `nextOrder` that is a number but not an index', async () => {
    // `NaN`, `Infinity` and anything at or past 2^53 all pass `typeof`, and then
    // `order + 1` either propagates NaN or **saturates** — so every registration
    // in the file is stamped with the same index and
    // `snapshotRegistration` maps them all to one shared `MAX_SAFE_INTEGER`.
    // Measured: three hooks composed `321` instead of `123`, with `errors: 0`.
    for (const poison of ['NaN', 'Infinity', '2 ** 53', '-1']) {
      const hooksDir = await writeHooks({
        'a.ts': [
          `import { beforeEach } from '@thymian/hooks';`,
          `${slot} = { nextOrder: ${poison}, created: [] };`,
          `const tag = (t) => async (value) => ({ ...value, path: value.path + t });`,
          `export const one = beforeEach(${JSON.stringify(selectorA)}, tag('1'));`,
          `export const two = beforeEach(${JSON.stringify(selectorA)}, tag('2'));`,
          `export const three = beforeEach(${JSON.stringify(selectorA)}, tag('3'));`,
          ``,
        ].join('\n'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(errorsOf(result), poison).toEqual([]);
      expect(await compose(result, firstTransactionId()), poison).toBe('123');
    }
  });

  it('reports a swallowed broken import even when nothing re-exports it', async () => {
    // Matching only what a *scanned file exported* was too narrow: with `a.ts`
    // swallowing the import and no sibling re-exporting, the scan came back
    // `hasErrors: false` with zero diagnostics — the silent bind the sweep
    // exists to refuse. A registration this scan **created** is equally about to
    // bind, so it counts as reachable.
    const hooksDir = await writeHooks({
      '.internal/broken.ts': [
        tagging(selectorA, 'BROKEN').trimEnd(),
        `throw new Error('broken exploded after exporting');`,
        ``,
      ].join('\n'),
      'a-swallows.ts': [
        `try {`,
        `  await import('./.internal/broken.js');`,
        `} catch {`,
        `  // swallowed`,
        `}`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result).join('\n')).toContain('broken.ts');
  });

  it('leaves a truncated message well-formed UTF-16', async () => {
    // `slice` at an arbitrary code-unit index splits a surrogate pair, so a
    // selector of emoji produced a message that was not well-formed — a lone
    // surrogate that JSON and the terminal both render as U+FFFD.
    const hooksDir = await writeHooks({
      'emoji.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('get /' + '\\u{1F600}'.repeat(400), async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const message = hookResolutionError(result.diagnostics).message;

    expect(message.isWellFormed()).toBe(true);
    expect(
      /[\uD800-\uDFFF]/u.test(message.replaceAll(/[\p{Emoji}]/gu, '')),
    ).toBe(false);
  });

  it('does not let the shared creation array grow without bound', async () => {
    // `created` has no readers left — collection goes through the async scope —
    // but it is part of the published shape and still receives creations made
    // outside any scan. Unbounded, it retains every callback closure ever
    // registered for the lifetime of the process.
    const before = hookCreationLog().created.length;

    for (let index = 0; index < 3_000; index += 1) {
      registerHook({
        kind: 'beforeEach',
        target: selectorA,
        callback: async (value: unknown) => value,
      } as Parameters<typeof registerHook>[0]);
    }

    const after = hookCreationLog().created.length;

    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(1_000);
  });
});

describe('loadUserHooks — round 7: the write round 6 never checked', () => {
  const slot = `globalThis[Symbol.for('@thymian/plugin-sampler.hook-creation-log')]`;

  /**
   * A slot whose `scope` is an **accessor**: the getter hands back a `run` that
   * never settles, and the setter silently drops whatever is written to it.
   *
   * Round 6 closed the data-property form of this by checking
   * `scope instanceof AsyncLocalStorage` and *repairing* the slot in place. The
   * repair was an assignment nobody read back, and on an accessor an assignment
   * proves nothing — so the check passed, the repair evaporated, and the value
   * that got called was still the poison.
   */
  const swallowingSetter = [
    `const poison = {`,
    `  run() { return new Promise(() => {}); },`,
    `  getStore() { return undefined; },`,
    `};`,
    `${slot} = {`,
    `  nextOrder: 0,`,
    `  created: [],`,
    `  get scope() { return poison; },`,
    `  set scope(value) { /* silently dropped */ },`,
    `};`,
    `export const nothing = 1;`,
    ``,
  ].join('\n');

  it('is not wedged by a scope repair the slot silently swallowed', async () => {
    // Measured against `6d3addf0`: `loadUserHooks` never settled at all — no
    // timeout, no diagnostic, and the healthy sibling below never bound.
    const hooksDir = await writeHooks({
      'a-poison.ts': swallowingSetter,
      'b-good.ts': tagging(selectorA, 'good'),
    });

    const outcome = await Promise.race([
      loadUserHooks(hooksDir, catalog),
      new Promise<'wedged'>((resolve) =>
        setTimeout(() => resolve('wedged'), 5_000),
      ),
    ]);

    expect(outcome).not.toBe('wedged');
    expect(
      await compose(outcome as LoadUserHooksResult, firstTransactionId()),
    ).toBe('good');
  }, 20_000);

  it('evicts the swallowing slot rather than tolerating it once per scan', async () => {
    // The serious half. The slot outlives the scan, so a scan that merely
    // *survives* the poison leaves it in place for every later scan in the
    // process — and `thymian serve` runs many. Surviving is not enough; the
    // poison has to be replaced, or the creation log is dead for the process
    // and every later scan silently loses its created-but-not-exported
    // diagnostic.
    const poisoned = await writeHooks({ 'a-poison.ts': swallowingSetter });

    await Promise.race([
      loadUserHooks(poisoned, catalog),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);

    // A later, unrelated scan whose only defect is a registration that was
    // created and never exported. Reporting it needs a *working* collection
    // scope, which is exactly what the poisoned slot destroys.
    const later = await writeHooks({
      'forgot.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        `export const nothing = 1;`,
        ``,
      ].join('\n'),
    });

    const result = await Promise.race([
      loadUserHooks(later, catalog),
      new Promise<'wedged'>((resolve) =>
        setTimeout(() => resolve('wedged'), 5_000),
      ),
    ]);

    expect(result).not.toBe('wedged');
    expect(errorsOf(result as LoadUserHooksResult).join('\n')).toContain(
      'but not exported',
    );
  }, 30_000);

  it('never calls a collection scope it did not itself check', async () => {
    // The value that gets called must be the value that was checked. `scope`
    // sits behind an accessor on a user-writable slot, so a check in one
    // function and a call in another are a check and a call on *two different
    // reads* — the same "verified over there, used over here" shape as every
    // other finding in this file. Both getters below pass the first read and go
    // bad on the second — one by lying, one by throwing, because a getter can
    // do either and only one of them was ever guarded.
    for (const [name, second] of [
      ['a scope that never settles', `poison`],
      ['a getter that throws', `(() => { throw new TypeError('boom'); })()`],
    ] as const) {
      const hooksDir = await writeHooks({
        'a-poison.ts': [
          `import { AsyncLocalStorage } from 'node:async_hooks';`,
          `const real = new AsyncLocalStorage();`,
          `const poison = { run() { return new Promise(() => {}); }, getStore() {} };`,
          `let reads = 0;`,
          `${slot} = {`,
          `  nextOrder: 0,`,
          `  created: [],`,
          `  get scope() { reads += 1; return reads === 1 ? real : ${second}; },`,
          `  set scope(value) {},`,
          `};`,
          `export const nothing = 1;`,
          ``,
        ].join('\n'),
        'b-good.ts': tagging(selectorA, 'good'),
      });

      const outcome = await Promise.race([
        loadUserHooks(hooksDir, catalog),
        new Promise<'wedged'>((resolve) =>
          setTimeout(() => resolve('wedged'), 5_000),
        ),
      ]);

      expect(outcome, name).not.toBe('wedged');
      expect(
        await compose(outcome as LoadUserHooksResult, firstTransactionId()),
        name,
      ).toBe('good');
    }
  }, 30_000);
});
