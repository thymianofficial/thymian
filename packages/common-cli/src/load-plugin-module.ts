import { resolve } from 'node:path';
import { inspect } from 'node:util';

import { CLIError } from '@oclif/core/errors';
import {
  isPlugin,
  loadUserModule,
  resolveUserModule,
  ThymianBaseError,
  type ThymianPlugin,
} from '@thymian/core';

import type { ThymianConfig } from './thymian-config.js';

/**
 * Debug sinks the wrapper supplies so this module never has to import oclif's `Command` to get
 * `this.debug` / `this.logger.debug` — see `apply-plugin-options.ts` for the same
 * extract-for-testability precedent.
 */
export interface LoadPluginModuleDebugSinks {
  debug?: (message: string, ...args: unknown[]) => void;
  loggerDebug?: (message: string, ...args: unknown[]) => void;
}

/**
 * Loads a plugin module by bare package name, absolute path, or config-relative path, resolving
 * and loading it through the shared `resolveUserModule` / `loadUserModule` seam (34.1) instead of
 * `require.resolve` + a raw dynamic import — which is what lets a TypeScript plugin load with no
 * build step and no Node flags.
 *
 * `preferCwdRelative: false` is passed unconditionally. Plugins have never had a cwd-directory
 * fallback for bare names — today's site passes a bare name straight to `require.resolve` with no
 * `existsSync` preference — and passing `true` would add one they never had.
 */
export async function loadPluginModule(
  nameOrPath: string,
  config: ThymianConfig,
  cwd: string,
  isRelativePath = false,
  sinks: LoadPluginModuleDebugSinks = {},
): Promise<ThymianPlugin> {
  const options = config.plugins[nameOrPath] ?? {};
  const location =
    isRelativePath || typeof options.path === 'string'
      ? resolve(cwd, options.path ?? nameOrPath)
      : nameOrPath;

  let pluginModule: unknown;

  sinks.debug?.('Load plugin module from location "%s".', location);

  try {
    const resolved = await resolveUserModule(location, cwd, {
      preferCwdRelative: false,
    });

    if (!resolved.ok) {
      // 34.4 will surface this cause; today it is flattened into PluginLoadError same as any
      // other `e`, so the reason must still be carried here rather than discarded.
      throw new Error(resolved.reason ?? `Cannot resolve plugin ${location}.`);
    }

    const module = await loadUserModule(resolved.path);
    pluginModule = module.default;
  } catch (e) {
    sinks.loggerDebug?.(
      'Failed to load plugin module from "%s": %s',
      location,
      inspect(e),
    );
    throw new ThymianBaseError(
      `Failed to load plugin module "${options.path ?? nameOrPath}".`,
      {
        name: 'PluginLoadError',
        cause: e,
      },
    );
  }

  if (!isPlugin(pluginModule)) {
    throw new CLIError(
      `"${
        options.path ?? nameOrPath
      }" does not default export a valid Thymian plugin.`,
    );
  }

  return pluginModule;
}
