import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { createJiti } from 'jiti';
import { afterAll, describe, expect, it } from 'vitest';

import * as staticallyImportedRuntime from '../src/hooks/hook-api.js';
import { isHookRegistration } from '../src/hooks/hook-registration.js';
import {
  HOOKS_RUNTIME_SPECIFIER,
  hooksRuntimeModulePath,
  loadUserHooks,
} from '../src/hooks/load-user-hooks.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { entryExists } from '../src/utils.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(2);
const catalog = TransactionCatalog.fromThymianFormat(format);
const [selectorA, selectorB] = catalog.selectors();

if (!selectorA || !selectorB) {
  throw new Error('fixture format must render two selectors');
}

function idOf(selector: string): string {
  const transaction = catalog.tryResolve(selector);

  if (!transaction) {
    throw new Error(`fixture selector ${selector} must resolve`);
  }

  return transaction.transactionId;
}

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

/**
 * A workspace that has never seen `sampler init`: a `.thymian/sampler/hooks`
 * directory and nothing else. No `generated/`, no `tsconfig.json`, no `types.d.ts`
 * — which is precisely the state every user is in before they run anything.
 */
async function uninitializedWorkspace(
  files: Record<string, string>,
): Promise<{ root: string; hooksDir: string; samplerRoot: string }> {
  const root = await createTempDir('.tmp-sampler-alias-');
  roots.push(root);

  const samplerRoot = join(root, '.thymian', 'sampler');
  const hooksDir = join(samplerRoot, 'hooks');
  await mkdir(hooksDir, { recursive: true });

  for (const [relative, content] of Object.entries(files)) {
    await writeFile(join(hooksDir, relative), content, 'utf-8');
  }

  return { root, hooksDir, samplerRoot };
}

describe('the `@thymian/hooks` alias target', () => {
  it('is an absolute, extensionless filesystem path — never a bare specifier', () => {
    const target = hooksRuntimeModulePath();

    // `package.json` exports only "." and "./package.json", so a bare
    // `@thymian/plugin-sampler/hook-api` would be blocked by the exports map in a
    // published install.
    expect(isAbsolute(target)).toBe(true);
    expect(target.startsWith('@')).toBe(false);
    expect(target).not.toContain('@thymian/plugin-sampler/');

    // Extensionless, so one target serves `dist/**.js` when installed and
    // `src/**.ts` when running from source.
    expect(target.endsWith('hook-api')).toBe(true);
    expect(/\.[cm]?[jt]s$/.test(target)).toBe(false);
  });

  it('maps to a path the published package actually ships', async () => {
    // The old assertion here — "the path contains a `src` segment" — was a
    // tautology: under Vitest the alias always resolves to the source file, so
    // it held no matter where the module lived or what the package shipped.
    //
    // What matters is the chain: the module sits under the build's `rootDir`,
    // the build emits into `outDir`, and `files` ships `outDir`. Break any link
    // — move the module out of `src/`, retarget the build, drop `dist` from
    // `files` — and the alias resolves to nothing in an installed CLI. The
    // packed tarball itself is checked by the e2e suite, which installs it.
    const packageRoot = join(import.meta.dirname, '..');

    const tsconfig = JSON.parse(
      await readFile(join(packageRoot, 'tsconfig.lib.json'), 'utf-8'),
    ) as { compilerOptions: { rootDir: string; outDir: string } };
    const manifest = JSON.parse(
      await readFile(join(packageRoot, 'package.json'), 'utf-8'),
    ) as { files: string[] };

    const fromRoot = relative(packageRoot, hooksRuntimeModulePath())
      .split(/[/\\]/)
      .join('/');
    const { rootDir, outDir } = tsconfig.compilerOptions;

    expect(fromRoot.startsWith(`${rootDir}/`)).toBe(true);
    expect(manifest.files).toContain(outDir);

    // Spelled out rather than derived, so a rename shows up here as a changed
    // expectation instead of a silently re-derived one.
    expect(`${outDir}/${fromRoot.slice(rootDir.length + 1)}.js`).toBe(
      'dist/hooks/hook-api.js',
    );
  });
});

describe('hooks execute with no `init` ever run (AC 4)', () => {
  it('loads a hook that imports runtime values from `@thymian/hooks`', async () => {
    const { hooksDir, samplerRoot } = await uninitializedWorkspace({
      'auth.ts': [
        `import { afterEach, authorize, beforeAll, beforeEach, defineSample } from '${HOOKS_RUNTIME_SPECIFIER}';`,
        ``,
        `export const sample = defineSample(${JSON.stringify(selectorA)}, (draft) => draft);`,
        `export const before = beforeEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        `export const after = afterEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        `export const auth = authorize(${JSON.stringify(selectorB)}, async (value) => value);`,
        `export const once = beforeAll(() => undefined);`,
        ``,
      ].join('\n'),
    });

    // The preconditions the AC is actually about, asserted rather than assumed.
    expect(await entryExists(join(samplerRoot, 'generated'))).toBe(false);
    expect(await entryExists(join(samplerRoot, 'tsconfig.json'))).toBe(false);
    expect(await entryExists(join(hooksDir, 'types.d.ts'))).toBe(false);

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual(
      [],
    );
    expect(result.hasErrors).toBe(false);

    const idA = idOf(selectorA);
    const idB = idOf(selectorB);

    expect(result.sampleDefinitions.has(idA)).toBe(true);
    expect(result.perTransaction.get(idA)?.beforeEach).toHaveLength(1);
    expect(result.perTransaction.get(idA)?.afterEach).toHaveLength(1);
    expect(result.perTransaction.get(idB)?.authorize).toBeDefined();
    expect(result.runScoped.beforeAll).toHaveLength(1);
  });

  it('reports an unresolvable specifier instead of silently loading nothing', async () => {
    const { hooksDir } = await uninitializedWorkspace({
      'wrong.ts': [
        `import { beforeEach } from '@thymian/hooks-typo';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // Guards the alias itself: if the alias silently stopped applying, every
    // hook file would fail exactly like this one — and the failure must be
    // loud, not an empty hook map.
    expect(result.hasErrors).toBe(true);
    expect(
      result.diagnostics.find((d) => d.severity === 'error')?.reason,
    ).toContain('could not be imported');
  });
});

describe('registration detection is cross-realm safe (AC 5)', () => {
  it('evaluates the runtime module in a registry of its own', async () => {
    const { hooksDir } = await uninitializedWorkspace({
      're-export.ts': `export { beforeEach } from '${HOOKS_RUNTIME_SPECIFIER}';\n`,
    });

    const jiti = createJiti(import.meta.url, {
      alias: { [HOOKS_RUNTIME_SPECIFIER]: hooksRuntimeModulePath() },
    });

    const throughAlias = await jiti.import<{
      beforeEach: typeof staticallyImportedRuntime.beforeEach;
    }>(join(hooksDir, 're-export.ts'));

    // This inequality IS the realm boundary. Two evaluations, two sets of
    // closures — so `instanceof`, a class identity, a plugin-held `WeakSet` and
    // a module-private `Symbol()` would every one of them fail here.
    expect(throughAlias.beforeEach).not.toBe(
      staticallyImportedRuntime.beforeEach,
    );

    // And the `Symbol.for` brand crosses it: a registration built by the other
    // realm's copy is recognised by this realm's predicate.
    const fromOtherRealm = throughAlias.beforeEach(
      selectorA,
      async (value) => value,
    );

    expect(isHookRegistration(fromOtherRealm)).toBe(true);
    expect(
      isHookRegistration(
        staticallyImportedRuntime.beforeEach(selectorA, async (v) => v),
      ),
    ).toBe(true);
  });

  it('shares the creation log across the boundary, unlike module scope', async () => {
    const { hooksDir } = await uninitializedWorkspace({
      'forgot.ts': [
        `import { beforeEach } from '${HOOKS_RUNTIME_SPECIFIER}';`,
        `beforeEach(${JSON.stringify(selectorA)}, async (value) => value);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // A module-scope counter would have reported zero here, forever: the plugin
    // reads its own realm's copy. Seeing "1" proves the `globalThis` slot is what
    // crosses the boundary.
    expect(
      result.diagnostics.find((d) => d.severity === 'error')?.reason,
    ).toContain('1 registration(s) created');
  });
});
