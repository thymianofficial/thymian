import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  _resetUserModuleLoaderStateForTests,
  loadUserModule,
  miscasedExtension,
  resolveUserModule,
  unloadableReason,
  type UserModuleResolution,
} from '../../src/load-user-module.js';
import {
  type BarePackageFixtures,
  makeBarePackageFixtures,
} from './bare-package-fixtures.js';

const basePath = import.meta.dirname;
const rulesDir = join(basePath, 'fixtures', 'rules');

function reasonOf(result: UserModuleResolution): string | undefined {
  return result.ok ? undefined : result.reason;
}

beforeEach(() => {
  _resetUserModuleLoaderStateForTests();
});

describe('resolveUserModule — local specifiers (§4.2)', () => {
  it('AC1: resolves a .ts rule at a relative path to its canonical path', () => {
    const result = resolveUserModule('./fixtures/rules/ts-rule.rule.ts', {
      cwd: basePath,
    });

    expect(result).toEqual({
      ok: true,
      path: join(rulesDir, 'ts-rule.rule.ts'),
    });
  });

  it('AC3: declines a .d.ts file because it is a declaration file, even though its contents are valid TypeScript exporting a rule', () => {
    const result = resolveUserModule('./fixtures/rules/declaration-rule.d.ts', {
      cwd: basePath,
    });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/declaration file/);
  });

  it('declines .mts as an unsupported extension, before ever touching the filesystem', () => {
    const result = resolveUserModule(
      './fixtures/rules/does-not-exist-at-all.mts',
      { cwd: basePath },
    );

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/\.mts/);
  });

  it('declines .cts as an unsupported extension', () => {
    const result = resolveUserModule(
      './fixtures/rules/does-not-exist-at-all.cts',
      { cwd: basePath },
    );

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/\.cts/);
  });

  it('declines a local specifier with no recognised extension, without guessing', () => {
    const result = resolveUserModule('./fixtures/rules/a', { cwd: basePath });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/loadable extension/);
  });

  it('has no <cwd>/<specifier> bare-to-local fallback: an unresolvable local path is "not found", not silently declined for another reason', () => {
    const result = resolveUserModule('./fixtures/rules/nope.rule.ts', {
      cwd: basePath,
    });

    expect(result).toEqual({ ok: false });
  });

  it('resolves an absolute path the same way as a relative one', () => {
    const absolute = join(rulesDir, 'ts-rule.rule.ts');
    const result = resolveUserModule(absolute, { cwd: '/nonexistent' });

    expect(result).toEqual({ ok: true, path: absolute });
  });

  it('treats bare "." and ".." as local directory references, not package names', () => {
    // Regression: `.`/`..` (no trailing slash) escaped the local-path guard
    // and were resolved as installed packages — silently resolving the cwd's
    // or parent's own package.json. They are local per §4.2, so they decline
    // as "no loadable extension" (a directory is not a loadable file), never
    // as a resolved package.
    for (const spec of ['.', '..']) {
      const result = resolveUserModule(spec, { cwd: basePath });

      expect(result.ok, `${spec} must not resolve as a package`).toBe(false);
      expect(reasonOf(result)).toMatch(/loadable extension/);
    }
  });
});

describe('resolveUserModule — bare specifiers (§4.1)', () => {
  let fixtures: BarePackageFixtures;
  let projectDir: string;

  beforeAll(() => {
    fixtures = makeBarePackageFixtures();
    projectDir = fixtures.projectDir;
  });

  afterAll(() => {
    fixtures.cleanup();
  });

  it('AC2: declines a bare specifier resolving to TypeScript source in node_modules', () => {
    const result = resolveUserModule('unbuilt-ts-pkg', { cwd: projectDir });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/ships unbuilt TypeScript source/);
  });

  it('declines a bare specifier resolving to a Node.js builtin id', () => {
    const result = resolveUserModule('node:fs', { cwd: basePath });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/builtin/);
  });

  it('declines a plain builtin name (no node: prefix) the same way', () => {
    const result = resolveUserModule('fs', { cwd: basePath });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/builtin/);
  });

  it('reports an installed-but-broken package.json rather than treating it as "not found"', () => {
    const result = resolveUserModule('broken-pkg', { cwd: projectDir });

    expect(result.ok).toBe(false);
    expect(reasonOf(result)).toMatch(/installed but broken/);
  });

  it('reports a genuinely uninstalled bare specifier as "not found" with no reason', () => {
    const result = resolveUserModule('this-package-does-not-exist-anywhere', {
      cwd: basePath,
    });

    expect(result).toEqual({ ok: false });
  });

  it('resolves a package that restricts "exports" and does not expose "./package.json" (must not be misreported as broken)', () => {
    // Regression: locating the package via the exports-gated
    // `<pkg>/package.json` subpath wrongly declined this — a common, loadable
    // package shape — as "installed but broken".
    const result = resolveUserModule('restricted-exports-pkg', {
      cwd: projectDir,
    });

    expect(result).toEqual({
      ok: true,
      path: fixtures.packageFile('restricted-exports-pkg', 'index.js'),
    });
  });

  it('honours an array-form "exports" (fallback sugar), not the decoy "main"', () => {
    // Regression: the exports guard skipped arrays and silently fell through
    // to `main`, loading the wrong file.
    const result = resolveUserModule('array-exports-pkg', { cwd: projectDir });

    expect(result).toEqual({
      ok: true,
      path: fixtures.packageFile('array-exports-pkg', 'correct.js'),
    });
  });
});

describe('resolveUserModule — never throws (§4.4, AC5)', () => {
  it('AC5: returns a discriminated failure instead of throwing when an internal path operation fails outright', () => {
    // A malformed `cwd` (e.g. threaded through from a config value that
    // failed its own validation) makes `path.resolve` throw a plain
    // TypeError before any of the seam's own guards run — the genuine
    // "unexpected internal error" case the outer catch exists for, as
    // opposed to the ordinary not-found/declined paths the seam already
    // handles explicitly.
    const malformedCwd = null as unknown as string;

    expect(() =>
      resolveUserModule('./fixtures/rules/ts-rule.rule.ts', {
        cwd: malformedCwd,
      }),
    ).not.toThrow();

    const result = resolveUserModule('./fixtures/rules/ts-rule.rule.ts', {
      cwd: malformedCwd,
    });

    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining('string'),
    });
  });
});

describe('unloadableReason / miscasedExtension — shared predicate (§4.6)', () => {
  it('flags a .d.ts file regardless of surrounding path', () => {
    expect(unloadableReason('/anywhere/x.d.ts')).toMatch(/declaration file/);
  });

  it('flags .mts and .cts', () => {
    expect(unloadableReason('/anywhere/x.mts')).toMatch(/\.mts/);
    expect(unloadableReason('/anywhere/x.cts')).toMatch(/\.cts/);
  });

  it('accepts every member of the closed loadable set', () => {
    expect(unloadableReason('/anywhere/x.ts')).toBeUndefined();
    expect(unloadableReason('/anywhere/x.js')).toBeUndefined();
    expect(unloadableReason('/anywhere/x.mjs')).toBeUndefined();
    expect(unloadableReason('/anywhere/x.cjs')).toBeUndefined();
  });

  it('flags an extension outside the closed set', () => {
    expect(unloadableReason('/anywhere/x.json')).toMatch(/loadable extension/);
  });

  it('flags a mis-cased extension against the on-disk (realpath) casing', () => {
    expect(miscasedExtension('/anywhere/x.TS', '/anywhere/x.ts')).toMatch(
      /casing/,
    );
  });

  it('does not flag matching casing', () => {
    expect(
      miscasedExtension('/anywhere/x.ts', '/anywhere/x.ts'),
    ).toBeUndefined();
  });
});

describe("loadUserModule — the load half cannot bypass the resolve half's guards", () => {
  it('throws a framed error for a .d.ts path, never "does not use default export"', async () => {
    const declarationPath = join(rulesDir, 'declaration-rule.d.ts');

    await expect(loadUserModule(declarationPath)).rejects.toMatchObject({
      name: 'UserModuleLoadError',
      message: expect.stringMatching(/declaration file/),
    });
  });

  it('AC1: loads a .ts module via jiti and exposes a default export', async () => {
    const tsPath = join(rulesDir, 'ts-rule.rule.ts');
    const module = await loadUserModule(tsPath);

    expect(module).toMatchObject({
      default: { meta: { name: 'ts-rule' } },
    });
  });
});

describe('loadUserModule — a rejected load is evicted, not pinned forever', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'thymian-f2-')));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retries after a transient failure instead of returning the cached rejection', async () => {
    // Regression: a rejected promise was cached under the canonical path for
    // the process lifetime, so a file that briefly vanished (or a one-off
    // transpile error) could never be loaded again. Node itself does not
    // cache ERR_MODULE_NOT_FOUND, so once our cache evicts the rejection the
    // restored file loads on the next call.
    const modPath = join(tmpDir, 'transient.mjs');
    writeFileSync(modPath, 'export default "OK";');
    const canonical = realpathSync.native(modPath);

    rmSync(modPath, { force: true });
    await expect(loadUserModule(canonical)).rejects.toBeDefined();

    writeFileSync(modPath, 'export default "OK";');
    const module = await loadUserModule(canonical);

    expect(module).toMatchObject({ default: 'OK' });
  });
});

describe('AC6: canonicalise once — two spellings of the same file resolve to the identical realpath', () => {
  // This proves the canonicalisation half of AC6 (resolveUserModule's job).
  // It does NOT by itself prove exactly-once execution: once both spellings
  // canonicalise to the identical string, native import()'s own per-URL
  // module registry already dedupes them regardless of our own cache — so
  // a counter here can't distinguish "our in-flight map worked" from
  // "the layer below deduped it anyway". The exactly-once *execution*
  // guarantee (loadUserModule's job, §4.5) is instead proven by spying on
  // the underlying loader's call count directly, in
  // load-user-module-ts-uses-jiti.test.ts.
  it('runs the module top-level body exactly once for two spellings of the same file, loaded concurrently', async () => {
    delete (globalThis as Record<string, unknown>).__resolverSeamCounterRuns;

    const direct = resolveUserModule('./fixtures/rules/counter.rule.mjs', {
      cwd: basePath,
    });
    const viaSymlink = resolveUserModule(
      './fixtures/rules/counter-link.rule.mjs',
      { cwd: basePath },
    );

    if (!direct.ok || !viaSymlink.ok) {
      throw new Error('expected both counter fixture spellings to resolve');
    }

    // Two different literal spellings must canonicalise to the identical
    // realpath — otherwise this test would not be exercising the seam's own
    // cache at all.
    expect(viaSymlink.path).toBe(direct.path);

    await Promise.all([
      loadUserModule(direct.path),
      loadUserModule(viaSymlink.path),
    ]);

    expect(
      (globalThis as Record<string, unknown>).__resolverSeamCounterRuns,
    ).toBe(1);
  });
});
