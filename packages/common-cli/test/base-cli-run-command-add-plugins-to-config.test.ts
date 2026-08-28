import { NoopLogger } from '@thymian/core';
import { describe, expect, it, vi } from 'vitest';

import { BaseCliRunCommand } from '../src/base-cli-run-command.js';

/**
 * Harness exercising the protected `addPluginsToThymianConfig` with a stubbed
 * `loadPluginModule`, so the path-vs-package *classification* is testable
 * without a real filesystem load. A `.\`-prefixed specifier can't be loaded
 * for real on POSIX (backslash is a legal filename char there), so a stub is
 * the only way to pin the classifier's treatment of Windows separators.
 */
function createHarness(plugins: Record<string, { path?: string }> = {}) {
  const harness = Object.create(BaseCliRunCommand.prototype) as InstanceType<
    typeof BaseCliRunCommand
  > & {
    addPluginsToThymianConfig: () => Promise<void>;
    loadPluginModule: (nameOrPath: string) => Promise<unknown>;
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  (harness as any).thymianConfig = { plugins };
  (harness as any).logger = new NoopLogger('test');
  (harness as any).debug = vi.fn();
  // Stub the load so classification is exercised in isolation: the returned
  // module name keys the config entry the classifier decides to write.
  (harness as any).loadPluginModule = vi.fn(async (specifier: string) => ({
    name: `plugin-for:${specifier}`,
    version: '*',
    plugin: () => undefined,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return harness;
}

function setPluginFlags(harness: unknown, plugin: string[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).flags = { plugin };
}

describe('BaseCliRunCommand.addPluginsToThymianConfig() — path classification', () => {
  it('persists `path` for a Windows-relative `.\\` specifier (regression: was misfiled as a package)', async () => {
    const harness = createHarness();
    const specifier = '.\\plugins\\my-plugin.plugin.ts';
    setPluginFlags(harness, [specifier]);

    await harness.addPluginsToThymianConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (harness as any).thymianConfig.plugins[
      `plugin-for:${specifier}`
    ];
    expect(entry).toEqual({ path: specifier });
  });

  it('persists `path` for a Windows-relative `..\\` specifier', async () => {
    const harness = createHarness();
    const specifier = '..\\my-plugin.plugin.ts';
    setPluginFlags(harness, [specifier]);

    await harness.addPluginsToThymianConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (harness as any).thymianConfig.plugins[
      `plugin-for:${specifier}`
    ];
    expect(entry).toEqual({ path: specifier });
  });

  it('persists `path` for a POSIX-relative `./` specifier (unchanged)', async () => {
    const harness = createHarness();
    const specifier = './plugins/my-plugin.plugin.ts';
    setPluginFlags(harness, [specifier]);

    await harness.addPluginsToThymianConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (harness as any).thymianConfig.plugins[
      `plugin-for:${specifier}`
    ];
    expect(entry).toEqual({ path: specifier });
  });

  it('does NOT persist `path` for a bare npm package specifier', async () => {
    const harness = createHarness();
    const specifier = '@scope/some-plugin';
    setPluginFlags(harness, [specifier]);

    await harness.addPluginsToThymianConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (harness as any).thymianConfig.plugins[
      `plugin-for:${specifier}`
    ];
    expect(entry).toEqual({});
  });
});
