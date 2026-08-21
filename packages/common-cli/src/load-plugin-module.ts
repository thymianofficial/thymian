import { resolve } from 'node:path';
import { inspect } from 'node:util';

import { CLIError } from '@oclif/core/errors';
import {
  isPlugin,
  isRecord,
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

// Node reports a missing import as ERR_MODULE_NOT_FOUND from ESM resolution and MODULE_NOT_FOUND
// from CJS; jiti can surface either depending on the file it is loading.
const MODULE_NOT_FOUND_CODES = new Set([
  'ERR_MODULE_NOT_FOUND',
  'MODULE_NOT_FOUND',
]);

// Codes this module attaches itself to the two `resolveUserModule` failure shapes, so
// `describePluginLoadFailure` can tell them apart from an arbitrary thrown error without
// re-deriving the distinction `resolveUserModule` already made.
const PLUGIN_UNRESOLVED_CODE = 'ERR_PLUGIN_UNRESOLVED';
const PLUGIN_UNLOADABLE_CODE = 'ERR_PLUGIN_UNLOADABLE';

const MODULE_NOT_FOUND_SPECIFIER_PATTERN =
  /Cannot find (?:module|package) ['"]([^'"]+)['"]/;

export interface DescribePluginLoadFailureResult {
  reason: string;
  suggestions: string[];
}

/**
 * Turns whatever `loadPluginModule` caught into a user-facing reason and, where the failure is
 * one we recognise, actionable suggestions. Exported and tested on its own so the mapping from
 * error to reason/suggestions doesn't have to be exercised only through the full load path.
 */
export function describePluginLoadFailure(
  error: unknown,
): DescribePluginLoadFailureResult {
  const reason = pluginLoadFailureReason(error);
  const code =
    isRecord(error) && typeof error.code === 'string' ? error.code : undefined;

  if (code !== undefined && MODULE_NOT_FOUND_CODES.has(code)) {
    return { reason, suggestions: [moduleNotFoundSuggestion(reason)] };
  }

  if (code === PLUGIN_UNRESOLVED_CODE) {
    return {
      reason,
      suggestions: [
        'Check the path or package name — .ts, .mts and .cts plugins load directly, with no build step.',
      ],
    };
  }

  if (code === PLUGIN_UNLOADABLE_CODE) {
    return {
      reason,
      suggestions: [
        'Point at the implementation file rather than its declarations or a non-module asset.',
      ],
    };
  }

  return { reason, suggestions: [] };
}

function pluginLoadFailureReason(error: unknown): string {
  if (!(error instanceof Error)) {
    return inspect(error, { depth: 3 });
  }

  const message = error.message.trim();

  return message.length > 0 ? message : inspect(error, { depth: 3 });
}

function moduleNotFoundSuggestion(reason: string): string {
  const specifier = MODULE_NOT_FOUND_SPECIFIER_PATTERN.exec(reason)?.[1];

  return specifier === undefined
    ? 'Check that the import resolves and that its package is installed.'
    : `Check that "${specifier}" resolves and that its package is installed.`;
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
      // Mirrors rule-loader.ts's two-sentence split (34.2): a `reason` is present only when the
      // specifier resolved to a real file that was then refused for what it IS; with no reason
      // there is genuinely nothing to add beyond "not found".
      const name = options.path ?? nameOrPath;

      throw Object.assign(
        new Error(
          resolved.reason === undefined
            ? `Cannot resolve plugin "${name}".`
            : `Cannot load plugin "${name}": ${resolved.reason}.`,
        ),
        {
          code:
            resolved.reason === undefined
              ? PLUGIN_UNRESOLVED_CODE
              : PLUGIN_UNLOADABLE_CODE,
        },
      );
    }

    const module = await loadUserModule(resolved.path);
    pluginModule = module.default;
  } catch (e) {
    sinks.loggerDebug?.(
      'Failed to load plugin module from "%s": %s',
      location,
      inspect(e),
    );
    const { reason, suggestions } = describePluginLoadFailure(e);

    throw new ThymianBaseError(
      `Failed to load plugin module "${options.path ?? nameOrPath}": ${reason}`,
      {
        name: 'PluginLoadError',
        cause: e,
        suggestions,
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
