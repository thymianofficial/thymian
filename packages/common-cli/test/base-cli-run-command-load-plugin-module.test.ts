import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { loadUserModule, resolveUserModule } from '@thymian/core/user-module';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BaseCliRunCommand } from '../src/base-cli-run-command.js';

// Spy-wrap (not replace) the seam's two entry points: real behaviour is
// preserved (these tests exercise real jiti/native-import loads through
// the real, built @thymian/core), but call args/counts are assertable.
// This proves the loader is wired through the seam — reintroducing the old
// require.resolve/import() pair would mean these are never called. The seam
// is exposed on the `@thymian/core/user-module` subpath (kept off the main
// barrel), which is what the loader imports.
vi.mock('@thymian/core/user-module', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@thymian/core/user-module')>();
  return {
    ...actual,
    resolveUserModule: vi.fn(actual.resolveUserModule),
    loadUserModule: vi.fn(actual.loadUserModule),
  };
});

const resolveUserModuleSpy = vi.mocked(resolveUserModule);
const loadUserModuleSpy = vi.mocked(loadUserModule);

const fixturesDir = join(import.meta.dirname, 'fixtures', 'plugins');

/**
 * Minimal harness exposing the protected `loadPluginModule` without a full
 * oclif command bootstrap — mirrors the pattern already established for
 * `guidance()` in guidance.test.ts.
 */
function createHarness(
  cwd: string = fixturesDir,
  plugins: Record<string, { path?: string }> = {},
) {
  const harness = Object.create(BaseCliRunCommand.prototype) as InstanceType<
    typeof BaseCliRunCommand
  > & {
    loadPluginModule: (nameOrPath: string) => Promise<unknown>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).flags = { cwd };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).thymianConfig = { plugins };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).logger = new NoopLogger('test');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).debug = vi.fn();

  return harness;
}

describe('BaseCliRunCommand.loadPluginModule() — routed through the shared seam', () => {
  afterEach(() => {
    resolveUserModuleSpy.mockClear();
    loadUserModuleSpy.mockClear();
  });

  describe('a .ts plugin loads through resolveUserModule/loadUserModule', () => {
    it('calls resolveUserModule with the raw specifier and cwd, then loadUserModule with the resolved path', async () => {
      const harness = createHarness();

      const pluginModule = await harness.loadPluginModule(
        './valid-plugin.plugin.ts',
      );

      expect(resolveUserModuleSpy).toHaveBeenCalledWith(
        './valid-plugin.plugin.ts',
        { cwd: fixturesDir },
      );
      expect(loadUserModuleSpy).toHaveBeenCalledTimes(1);
      expect(loadUserModuleSpy).toHaveBeenCalledWith(
        join(fixturesDir, 'valid-plugin.plugin.ts'),
      );
      expect(pluginModule).toMatchObject({
        name: 'valid-ts-plugin',
        version: '*',
      });
    });
  });

  describe("validation identical for a jiti-loaded plugin, proven against jiti's actual return", () => {
    it('extracts the plugin from the real jiti namespace default key and passes isPlugin', async () => {
      const harness = createHarness();

      const pluginModule = (await harness.loadPluginModule(
        './valid-plugin.plugin.ts',
      )) as { plugin: unknown; name: string; version: string };

      // Prove the ACTUAL namespace shape jiti returned, rather than assuming
      // it — the exact trap this guards against.
      const rawNamespace = await loadUserModuleSpy.mock.results[0]!.value;
      expect(rawNamespace).toHaveProperty('default');
      expect((rawNamespace as { default: unknown }).default).toMatchObject({
        name: 'valid-ts-plugin',
      });

      expect(typeof pluginModule.plugin).toBe('function');
      expect(pluginModule.name).toBe('valid-ts-plugin');
      expect(pluginModule.version).toBe('*');
    });
  });

  describe('PluginLoadError names the real cause without --debug', () => {
    it('includes the underlying evaluation-time error message in the thrown error', async () => {
      const harness = createHarness();

      await expect(
        harness.loadPluginModule('./throwing-plugin.plugin.mjs'),
      ).rejects.toMatchObject({
        name: 'PluginLoadError',
        message: expect.stringContaining('boom during plugin evaluation'),
      });
    });

    it('does not offer export-shape advice for an evaluation-time throw', async () => {
      const harness = createHarness();

      const error = await harness
        .loadPluginModule('./throwing-plugin.plugin.mjs')
        .catch((e: unknown) => e);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionText: string = (error as any).options.suggestions.join(
        ' ',
      );
      expect(suggestionText).not.toMatch(/export default|module\.exports/);
    });

    it('gives an unresolvable (not-installed) plugin its own non-empty reason', async () => {
      const harness = createHarness();

      await expect(
        harness.loadPluginModule(
          '@thymian/definitely-not-installed-plugin-fixture',
        ),
      ).rejects.toMatchObject({
        name: 'PluginLoadError',
        message: expect.stringMatching(
          /cannot resolve plugin "@thymian\/definitely-not-installed-plugin-fixture"/i,
        ),
      });
    });
  });

  describe('named-only / module.exports = { … } with no usable default is rejected', () => {
    it('rejects a named-only ESM module (no default at all) and never synthesises one', async () => {
      const harness = createHarness();

      await expect(
        harness.loadPluginModule('./named-only-plugin.plugin.mjs'),
      ).rejects.toMatchObject({
        name: 'PluginLoadError',
      });
    });

    it('rejects a module.exports = { … } wrapper object with no plugin-shaped default', async () => {
      const harness = createHarness();

      await expect(
        harness.loadPluginModule('./wrapped-object-plugin.plugin.cjs'),
      ).rejects.toMatchObject({
        name: 'PluginLoadError',
      });
    });

    it('suggestion text advertises only shapes that actually work — never a named-export shape', async () => {
      const harness = createHarness();

      const error = await harness
        .loadPluginModule('./named-only-plugin.plugin.mjs')
        .catch((e: unknown) => e);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestions: string[] = (error as any).options.suggestions;
      const suggestionText = suggestions.join(' ');

      expect(suggestionText).toMatch(/export default|module\.exports/);
      expect(suggestionText).not.toMatch(/named export/i);
    });
  });

  describe('config `path` field is a syntactic specifier (intended, pinned)', () => {
    it('treats a bare-looking config `path` as an installed package, not a cwd-relative file', async () => {
      // Regression pin for the intended behaviour: the old loader resolved
      // ANY `options.path` cwd-relative; the seam now decides bare-vs-local
      // syntactically, so a bare `path` (no ./) is an npm-package specifier.
      // This is intended (there is no `<cwd>/<specifier>` fallback) — the
      // documented form is `./`-prefixed. This test locks the behaviour so a
      // future change to it is a conscious one.
      const harness = createHarness(fixturesDir, {
        'my-plugin': { path: 'plugins/foo.js' },
      });

      await expect(harness.loadPluginModule('my-plugin')).rejects.toMatchObject(
        {
          name: 'PluginLoadError',
          message: expect.stringMatching(
            /cannot resolve plugin "plugins\/foo\.js"/i,
          ),
        },
      );

      // resolveUserModule saw the bare specifier verbatim (no ./ prepended).
      expect(resolveUserModuleSpy).toHaveBeenCalledWith('plugins/foo.js', {
        cwd: fixturesDir,
      });
    });

    it('offers the relative-path spelling when a bare, path-like specifier is not found', async () => {
      const harness = createHarness(fixturesDir, {
        'my-plugin': { path: 'plugins/foo.js' },
      });

      const error = await harness
        .loadPluginModule('my-plugin')
        .catch((e: unknown) => e);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionText: string = (error as any).options.suggestions.join(
        ' ',
      );
      expect(suggestionText).toContain('"./plugins/foo.js"');
    });

    it('does NOT offer the relative-path spelling for a `.d.ts` specifier (never loadable)', async () => {
      const harness = createHarness(fixturesDir, {
        'my-plugin': { path: 'plugins/foo.d.ts' },
      });

      const error = await harness
        .loadPluginModule('my-plugin')
        .catch((e: unknown) => e);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestionText: string = (error as any).options.suggestions.join(
        ' ',
      );
      // A `.d.ts` ends in `.ts` but the loader refuses it, so the hint that
      // advertises a `./`-spelling must not fire for it.
      expect(suggestionText).not.toContain('plugins/foo.d.ts');
    });

    it('a `./`-prefixed config `path` still loads (the documented form is unaffected)', async () => {
      const harness = createHarness(fixturesDir, {
        'my-plugin': { path: './valid-plugin.plugin.ts' },
      });

      const pluginModule = (await harness.loadPluginModule('my-plugin')) as {
        name: string;
      };

      expect(pluginModule.name).toBe('valid-ts-plugin');
    });
  });
});
