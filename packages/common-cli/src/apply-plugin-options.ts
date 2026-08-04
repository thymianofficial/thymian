import type { SortReportsBy } from '@thymian/core';

import type { ThymianConfig } from './thymian-config.js';

/** The reporter plugin whose file formatters honour `--sort-reports-by`. */
export const REPORTER_PLUGIN_NAME = '@thymian/plugin-reporter';

/**
 * Sets a single option on a plugin's config — but ONLY when that plugin is
 * already configured, so wiring a flag never auto-registers a plugin the user
 * did not ask for. Overwrites any existing value for `key`.
 */
export function setConfiguredPluginOption(
  config: ThymianConfig,
  pluginName: string,
  key: string,
  value: unknown,
): void {
  const plugin = config.plugins[pluginName];
  if (!plugin) {
    return;
  }

  plugin.options ??= {};
  (plugin.options as Record<string, unknown>)[key] = value;
}

/**
 * Forwards an explicit `--sort-reports-by` flag to the reporter plugin so its
 * file formatters group findings to match the CLI report.
 *
 * PRECEDENCE: this is called AFTER the `-o` overrides are applied, so an
 * explicit flag intentionally WINS over — and overwrites — any
 * `-o …options.sortReportsBy=…` or config-file value. When the flag is absent
 * (`undefined`) nothing is written, so the `-o`/config value survives. If the
 * reporter is not configured, this is a no-op (never auto-registers it).
 */
export function applyReporterSortReportsBy(
  config: ThymianConfig,
  sortReportsBy: SortReportsBy | undefined,
): void {
  if (sortReportsBy === undefined) {
    return;
  }

  setConfiguredPluginOption(
    config,
    REPORTER_PLUGIN_NAME,
    'sortReportsBy',
    sortReportsBy,
  );
}
