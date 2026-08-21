import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isPlugin, loadUserModule, resolveUserModule } from '@thymian/core';
import { describe, expect, it, vi } from 'vitest';

import { loadPluginModule } from '../src/load-plugin-module.js';
import type { ThymianConfig } from '../src/thymian-config.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', 'plugins');

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
        'Failed to load plugin module "./fixtures/plugins/does-not-exist.ts".',
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
        'Failed to load plugin module "./fixtures/plugins/does-not-exist.ts".',
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
});
