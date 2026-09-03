import { mkdir } from 'node:fs/promises';

import {
  type Logger,
  type SortReportsBy,
  ThymianBaseError,
} from '@thymian/core';

import type { FileFormatterOptions, Formatter } from './formatter.js';
import { CsvFormatter, type CsvFormatterOptions } from './formatters/csv.js';
import { JsonFormatter, type JsonFormatterOptions } from './formatters/json.js';
import {
  MarkdownFormatter,
  type MarkdownFormatterOptions,
} from './formatters/markdown.js';
import { resolveReportsBaseDirectory } from './report-file-name.js';

export type Formatters = {
  markdown: Partial<MarkdownFormatterOptions>;
  csv: Partial<CsvFormatterOptions>;
  json: Partial<JsonFormatterOptions>;
};

export type ReporterPluginOptions = {
  formatters?: Partial<Formatters>;
  reportsDir?: string;
};

export type FormatterConstructor<T> = (logger: Logger) => Formatter<T>;

/**
 * What a formatter is initialised with: the user's config plus the runtime
 * context it needs to place its files — the run `cwd` and the plugin-level
 * `reportsDir`. Both are injected, neither is a formatter option: the plugin's
 * options schema is `additionalProperties: false`, so they must not appear in
 * {@link Formatters}.
 */
export type PreparedFormatterOptions = FileFormatterOptions & {
  cwd: string;
  reportsDir?: string;
};

export type FormatterRegistryEntry<K extends keyof Formatters> = {
  factory: FormatterConstructor<Formatters[K]>;
  prepareOptions: (
    options: Formatters[K],
    pluginOptions: { cwd: string; reportsDir?: string; logger: Logger },
  ) => PreparedFormatterOptions;
};

/**
 * Hand the run's `cwd` and the plugin-level `reportsDir` down to a formatter.
 *
 * Nothing is resolved here: each report lands in its own directory named after
 * that report's `createdAt`/`reportId`, and no report exists yet at plugin
 * construction time. Every formatter therefore resolves a destination per
 * `report()` via `resolveReportPath`.
 */
function prepareFileOptions(
  options: FileFormatterOptions,
  cwd: string,
  reportsDir: string | undefined,
): PreparedFormatterOptions {
  return { ...options, cwd, reportsDir };
}

export const FORMATTER_REGISTRY: {
  [K in keyof Formatters]: FormatterRegistryEntry<K>;
} = {
  markdown: {
    factory: (logger) => new MarkdownFormatter(logger),
    prepareOptions: (options, { cwd, reportsDir }) =>
      prepareFileOptions(options, cwd, reportsDir),
  },
  csv: {
    factory: (logger) => new CsvFormatter(logger),
    prepareOptions: (options, { cwd, reportsDir }) =>
      prepareFileOptions(options, cwd, reportsDir),
  },
  json: {
    factory: (logger) => new JsonFormatter(logger),
    prepareOptions: (options, { cwd, reportsDir }) =>
      prepareFileOptions(options, cwd, reportsDir),
  },
} as const;

export function isValidFormatter(name: string): name is keyof Formatters {
  return Object.hasOwn(FORMATTER_REGISTRY, name);
}

/**
 * Precondition for a run that is going to write reports: create the shared base
 * directory once, up front, so an unusable `reportsDir` fails while the plugin
 * is still registering — surfacing as a `PluginRegistrationError` and exiting
 * before a single workflow runs.
 *
 * Without it a read-only mount, a missing permission, or a plain file shadowing
 * the base path produced one stderr line per report and still exited 0: CI
 * globbed the run directories under the base, matched nothing, and went green
 * while every finding was hidden.
 *
 * Deliberately asymmetric with the formatters, and it must stay that way: an
 * *in-flight* write failure keeps degrading (logged via `logger.error`, never
 * thrown). By the time a report is being written its findings are already
 * computed, and aborting then destroys output that is still useful. Only this
 * up-front check fails hard.
 */
async function ensureReportsDirectory(
  cwd: string,
  reportsDir: string | undefined,
): Promise<void> {
  const directory = resolveReportsBaseDirectory(cwd, reportsDir);

  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);

    throw new ThymianBaseError(
      `Cannot create the report output directory "${directory}": ${cause}`,
      {
        name: 'UnusableReportsDirectoryError',
        ref: 'https://thymian.dev/references/errors/unusable-reports-directory-error/',
        cause: error,
        suggestions: [
          `Check that "${directory}" can be created and written to — a read-only mount or a missing permission fails here (EROFS, EACCES).`,
          'Make sure no regular file sits on that path or on one of its parents; a file where a directory is expected fails with ENOTDIR.',
          'Point the plugin-level "reportsDir" option at a writable directory, e.g. `reportsDir: build/reports`.',
          'If this run should not write report files at all, drop the "formatters" option — an empty `formatters` creates no directory.',
        ],
      },
    );
  }
}

export async function getFormatters(
  config: ReporterPluginOptions['formatters'] = {},
  cwd: string,
  logger: Logger,
  sortReportsBy?: SortReportsBy,
  reportsDir?: string,
): Promise<Formatter[]> {
  const entries = Object.entries(config);

  // The precondition runs before anything is constructed: a base directory
  // that cannot be created is a run whose findings would never reach disk.
  if (entries.length > 0) {
    // Once for the shared base, not once per formatter — and only when a
    // formatter is actually configured, so `formatters: {}` creates nothing.
    await ensureReportsDirectory(cwd, reportsDir);
  }

  return Promise.all(
    entries.map(async ([name, options]) => {
      if (!isValidFormatter(name)) {
        throw new ThymianBaseError(
          `Unknown formatter "${name}". Available formatters: ${Object.keys(FORMATTER_REGISTRY).join(', ')}.`,
          {
            name: 'UnknownFormatterError',
            ref: 'https://thymian.dev/references/errors/unknown-formatter-error/',
            suggestions: [
              'If you want to add your own formatter, implement a new plugin and listen on the `core.report` event and/or open a Github issue.',
            ],
          },
        );
      }

      const formatterConfig = FORMATTER_REGISTRY[name];

      const formatter = formatterConfig.factory(logger);

      const preparedOptions = formatterConfig.prepareOptions(options, {
        cwd,
        reportsDir,
        logger,
      });

      // we know that the options are valid, so we can safely cast them.
      // `sortReportsBy` rides along for every formatter; only markdown reads it.
      await formatter.init({ ...preparedOptions, sortReportsBy } as never);

      return formatter;
    }),
  );
}
