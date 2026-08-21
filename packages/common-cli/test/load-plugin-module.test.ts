import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isPlugin,
  isThymianError,
  loadUserModule,
  resolveUserModule,
  ThymianBaseError,
} from '@thymian/core';
import { describe, expect, it, vi } from 'vitest';

import {
  describePluginLoadFailure,
  loadPluginModule,
} from '../src/load-plugin-module.js';
import type { ThymianConfig } from '../src/thymian-config.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', 'plugins');

function pluginErrorSuggestions(error: unknown): string[] {
  if (!isThymianError(error)) {
    throw new Error(`Expected a ThymianError, got: ${String(error)}`);
  }

  return error.options?.suggestions ?? [];
}

function configWith(
  plugins: Record<string, { path?: string; autoload?: boolean }> = {},
): ThymianConfig {
  return { plugins } as unknown as ThymianConfig;
}

/**
 * Builds a temp cwd with a `node_modules/<name>` package whose entry point is a copy of the
 * `js-plugin.mjs` fixture, so a real bare-specifier resolution (not a path) can be exercised
 * without ever checking a `node_modules` directory into the repo. Callers must `rm` the returned
 * cwd when done.
 */
async function withInstalledPlugin(): Promise<{ cwd: string; name: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'thymian-plugin-pkg-'));
  const name = 'fixture-plugin-package';
  const pkgDir = join(cwd, 'node_modules', name);

  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name, main: 'index.mjs', type: 'module' }),
  );
  await copyFile(
    join(FIXTURES_DIR, 'js-plugin.mjs'),
    join(pkgDir, 'index.mjs'),
  );

  return { cwd, name };
}

describe('loadPluginModule', () => {
  describe('entry points (AC4)', () => {
    it('loads a TypeScript plugin from a relative path', async () => {
      const plugin = await loadPluginModule(
        './fixtures/plugins/ts-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      );

      expect(plugin.name).toBe('ts-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('loads a TypeScript plugin from an absolute path', async () => {
      const plugin = await loadPluginModule(
        join(FIXTURES_DIR, 'ts-plugin.ts'),
        configWith(),
        import.meta.dirname,
        false,
      );

      expect(plugin.name).toBe('ts-plugin');
    });

    it('loads a plugin from plugins[name].path in config', async () => {
      const config = configWith({
        'my-plugin': { path: './fixtures/plugins/ts-plugin.ts' },
      });

      const plugin = await loadPluginModule(
        'my-plugin',
        config,
        import.meta.dirname,
      );

      expect(plugin.name).toBe('ts-plugin');
    });

    it('loads an unchanged JavaScript plugin from a bare package specifier', async () => {
      const { cwd, name } = await withInstalledPlugin();

      try {
        const plugin = await loadPluginModule(name, configWith(), cwd, false);

        expect(plugin.name).toBe('js-plugin');
        expect(plugin.version).toBe('1.0.0');
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });

    it('loads a plain CommonJS plugin (module.exports, no ESM default marker)', async () => {
      const plugin = await loadPluginModule(
        './fixtures/plugins/cjs-plugin.cjs',
        configWith(),
        import.meta.dirname,
        true,
      );

      expect(plugin.name).toBe('cjs-plugin');
      expect(plugin.version).toBe('1.0.0');
    });
  });

  describe('preferCwdRelative: false (AC3)', () => {
    it('discriminates a local-only plugin directory by the flag', async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'thymian-plugin-decoy-'));

      try {
        const localDir = join(cwd, 'local-only-plugin');

        await mkdir(localDir, { recursive: true });
        await writeFile(
          join(localDir, 'index.js'),
          "export default 'local';\n",
        );

        const withFallback = await resolveUserModule('local-only-plugin', cwd, {
          preferCwdRelative: true,
        });
        const withoutFallback = await resolveUserModule(
          'local-only-plugin',
          cwd,
          { preferCwdRelative: false },
        );

        expect(withFallback.ok).toBe(true);
        expect(withoutFallback.ok).toBe(false);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });

    it('still resolves a bare package plugin', async () => {
      const { cwd, name } = await withInstalledPlugin();

      try {
        const resolved = await resolveUserModule(name, cwd, {
          preferCwdRelative: false,
        });

        expect(resolved.ok).toBe(true);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });

    it("still resolves via core's own install directory when the user's project has no match at all", async () => {
      // No `node_modules` anywhere under this cwd, so the first anchor (the user's project) can
      // never answer — this specifically exercises the SECOND anchor, core's own install
      // directory, which the other bare-package tests above never reach because their fake
      // package always satisfies the first anchor. `yaml` is a real, already-installed
      // dependency reachable from core's anchor via the workspace's hoisted `node_modules`.
      const cwd = await mkdtemp(join(tmpdir(), 'thymian-plugin-empty-cwd-'));

      try {
        const resolved = await resolveUserModule('yaml', cwd, {
          preferCwdRelative: false,
        });

        expect(resolved.ok).toBe(true);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript plugin reproductions (AC5)', () => {
    it.each([
      ['an erasable-syntax .ts plugin', 'ts-plugin.ts', 'ts-plugin'],
      ['a .ts plugin using an enum', 'enum-plugin.ts', 'enum-plugin-thyme'],
      ['a .mts plugin', 'plugin.mts', 'plugin-mts'],
      ['a .cts plugin', 'plugin.cts', 'plugin-cts'],
      [
        'a plugin importing ./helper with no extension',
        'split-extensionless-plugin.ts',
        'split-extensionless',
      ],
      [
        'a plugin importing ./helper.js (NodeNext spelling)',
        'split-nodenext-plugin.ts',
        'split-nodenext',
      ],
    ])('loads %s', async (_label, file, expectedName) => {
      const plugin = await loadPluginModule(
        `./fixtures/plugins/${file}`,
        configWith(),
        import.meta.dirname,
        true,
      );

      expect(plugin.name).toBe(expectedName);
      expect(typeof plugin.plugin).toBe('function');
    });
  });

  describe('isPlugin accepts a jiti-loaded plugin (AC6)', () => {
    it('is true for a jiti-loaded TypeScript plugin default export', async () => {
      const resolved = await resolveUserModule(
        join(FIXTURES_DIR, 'ts-plugin.ts'),
        import.meta.dirname,
      );

      if (!resolved.ok) {
        throw new Error('fixture failed to resolve');
      }

      const module = await loadUserModule(resolved.path);

      expect(isPlugin(module.default)).toBe(true);
    });

    it('is false for a default export missing version', async () => {
      const resolved = await resolveUserModule(
        join(FIXTURES_DIR, 'not-a-plugin.ts'),
        import.meta.dirname,
      );

      if (!resolved.ok) {
        throw new Error('fixture failed to resolve');
      }

      const module = await loadUserModule(resolved.path);

      expect(isPlugin(module.default)).toBe(false);
    });
  });

  describe('error behaviour (AC7)', () => {
    it('throws PluginLoadError naming the specifier when resolution fails', async () => {
      await expect(
        loadPluginModule(
          './fixtures/plugins/does-not-exist.ts',
          configWith(),
          import.meta.dirname,
          true,
        ),
      ).rejects.toThrow(
        'Failed to load plugin module "./fixtures/plugins/does-not-exist.ts": ' +
          'Cannot resolve plugin "./fixtures/plugins/does-not-exist.ts".',
      );
    });

    it('sets PluginLoadError as the error name, with the underlying failure as cause', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/does-not-exist.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e);

      expect(error).toMatchObject({ name: 'PluginLoadError' });
      expect((error as Error).cause).toBeInstanceOf(Error);
    });

    it('throws a CLIError naming the specifier when the default export is not a valid plugin', async () => {
      await expect(
        loadPluginModule(
          './fixtures/plugins/not-a-plugin.ts',
          configWith(),
          import.meta.dirname,
          true,
        ),
      ).rejects.toThrow(
        '"./fixtures/plugins/not-a-plugin.ts" does not default export a valid Thymian plugin.',
      );
    });

    it('names the configured path, not the specifier, in error messages', async () => {
      const config = configWith({
        'my-plugin': { path: './fixtures/plugins/does-not-exist.ts' },
      });

      await expect(
        loadPluginModule('my-plugin', config, import.meta.dirname),
      ).rejects.toThrow(
        'Failed to load plugin module "./fixtures/plugins/does-not-exist.ts": ' +
          'Cannot resolve plugin "./fixtures/plugins/does-not-exist.ts".',
      );
    });

    it("carries resolveUserModule's reason through as the cause message, for a file that resolves but is declined for its extension", async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/not-code.json',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e);

      expect((error as Error).cause).toBeInstanceOf(Error);
      expect(((error as Error).cause as Error).message).toBe(
        'Cannot load plugin "./fixtures/plugins/not-code.json": only JavaScript ' +
          'and TypeScript modules can be loaded.',
      );
    });
  });

  describe('debug sinks', () => {
    it('calls the debug sink before the load attempt and the loggerDebug sink on failure', async () => {
      const debug = vi.fn();
      const loggerDebug = vi.fn();

      await loadPluginModule(
        './fixtures/plugins/does-not-exist.ts',
        configWith(),
        import.meta.dirname,
        true,
        { debug, loggerDebug },
      ).catch(() => undefined);

      expect(debug).toHaveBeenCalledWith(
        'Load plugin module from location "%s".',
        join(import.meta.dirname, 'fixtures/plugins/does-not-exist.ts'),
      );
      expect(loggerDebug).toHaveBeenCalledOnce();
    });

    it('does not throw when no sinks are provided', async () => {
      const plugin = await loadPluginModule(
        './fixtures/plugins/ts-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      );

      expect(plugin.name).toBe('ts-plugin');
    });
  });

  describe('describePluginLoadFailure', () => {
    it('uses the message for an Error with content', () => {
      const result = describePluginLoadFailure(new Error('boom'));

      expect(result.reason).toBe('boom.');
    });

    it('does not prepend the error name to the message', () => {
      const result = describePluginLoadFailure(new TypeError('boom'));

      expect(result.reason).toBe('boom.');
    });

    it('falls back to inspect for a non-Error throw', () => {
      const result = describePluginLoadFailure('boom');

      expect(result.reason).toContain('boom');
    });

    it('falls back to inspect when the Error message is empty', () => {
      const result = describePluginLoadFailure(new Error(''));

      expect(result.reason).not.toBe('');
      expect(result.reason).not.toMatch(/: $/);
    });

    it('does not leak a multi-line stack trace into the reason for an empty-message Error', () => {
      const result = describePluginLoadFailure(new Error(''));

      expect(result.reason).not.toContain('\n');
      expect(result.reason).not.toContain('    at ');
    });

    it('takes only the first line of a multi-line Error message', () => {
      const error = new Error(
        "Cannot find module './helper'\nRequire stack:\n- /abs/path/plugin.ts",
      );
      const result = describePluginLoadFailure(error);

      expect(result.reason).toBe("Cannot find module './helper'.");
    });

    it('does not double a trailing period that is already present', () => {
      const result = describePluginLoadFailure(
        new Error('already punctuated.'),
      );

      expect(result.reason).toBe('already punctuated.');
    });

    it('propagates suggestions already authored on a caught ThymianError instead of discarding them', () => {
      const cycleError = new ThymianBaseError(
        'Cannot load user module /abs/plugin.ts: it is already being evaluated.',
        {
          name: 'UserModuleLoadError',
          suggestions: [
            'Break the cycle by importing the shared module directly instead of loading it through Thymian.',
          ],
        },
      );
      const result = describePluginLoadFailure(cycleError);

      expect(result.suggestions).toEqual([
        'Break the cycle by importing the shared module directly instead of loading it through Thymian.',
      ]);
    });

    it('falls back to inspect when the Error message is whitespace-only', () => {
      const result = describePluginLoadFailure(new Error('   '));

      expect(result.reason.trim()).not.toBe('');
    });

    it('suggests checking the import for ERR_MODULE_NOT_FOUND', () => {
      const error = Object.assign(new Error("Cannot find module './helper'"), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
      const result = describePluginLoadFailure(error);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('./helper');
    });

    it('suggests checking the import for MODULE_NOT_FOUND', () => {
      const error = Object.assign(new Error("Cannot find module './helper'"), {
        code: 'MODULE_NOT_FOUND',
      });
      const result = describePluginLoadFailure(error);

      expect(result.suggestions).toHaveLength(1);
    });

    it('degrades to a generic suggestion when the specifier cannot be parsed out', () => {
      const error = Object.assign(new Error('module resolution failed'), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
      const result = describePluginLoadFailure(error);

      expect(result.suggestions).toEqual([
        'Check that the import resolves and that its package is installed.',
      ]);
    });

    it('invents no suggestion for an unrecognised failure', () => {
      const result = describePluginLoadFailure(new Error('boom'));

      expect(result.suggestions).toEqual([]);
    });
  });

  describe('story 34.4 — the reason and suggestions surface in the message', () => {
    it('names a missing import (ERR_MODULE_NOT_FOUND/MODULE_NOT_FOUND) as the reason, with a suggestion', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/missing-import-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toContain(
        'Failed to load plugin module "./fixtures/plugins/missing-import-plugin.ts": ',
      );
      expect(error.message).toContain('does-not-exist');
      expect(error.message).not.toMatch(/: $/);
      expect(pluginErrorSuggestions(error)).not.toHaveLength(0);
    });

    it('names a genuine TypeScript syntax error as the reason', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/syntax-error-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toContain(
        'Failed to load plugin module "./fixtures/plugins/syntax-error-plugin.ts": ',
      );
      expect(error.message).not.toMatch(/: $/);
    });

    it('names an Error thrown at module evaluation as the reason', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/throws-on-load-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toBe(
        'Failed to load plugin module "./fixtures/plugins/throws-on-load-plugin.ts": boom.',
      );
    });

    it('names an unresolvable specifier as "Cannot resolve", with a suggestion', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/does-not-exist.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toBe(
        'Failed to load plugin module "./fixtures/plugins/does-not-exist.ts": ' +
          'Cannot resolve plugin "./fixtures/plugins/does-not-exist.ts".',
      );
      expect(pluginErrorSuggestions(error)).not.toHaveLength(0);
    });

    it("renders a *.d.ts specifier's rendered reason, not merely that it failed", async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/types.d.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toBe(
        'Failed to load plugin module "./fixtures/plugins/types.d.ts": ' +
          'Cannot load plugin "./fixtures/plugins/types.d.ts": a TypeScript declaration file ' +
          'contains no runtime code.',
      );
    });

    it('falls back to inspect for a non-Error throw, with no bare trailing colon', async () => {
      const error = await loadPluginModule(
        './fixtures/plugins/throws-non-error-plugin.ts',
        configWith(),
        import.meta.dirname,
        true,
      ).catch((e: unknown) => e as Error);

      expect(error.message).toContain(
        'Failed to load plugin module "./fixtures/plugins/throws-non-error-plugin.ts": ',
      );
      expect(error.message).toContain('boom');
      expect(error.message).not.toMatch(/: $/);
    });
  });
});
