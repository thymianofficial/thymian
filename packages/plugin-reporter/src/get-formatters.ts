import { resolve } from 'node:path';

import {
  type Logger,
  type SortReportsBy,
  ThymianBaseError,
} from '@thymian/core';

import type { Formatter } from './formatter.js';
import { CsvFormatter, type CsvFormatterOptions } from './formatters/csv.js';
import { JsonFormatter, type JsonFormatterOptions } from './formatters/json.js';
import {
  MarkdownFormatter,
  type MarkdownFormatterOptions,
} from './formatters/markdown.js';

export type Formatters = {
  markdown: Partial<MarkdownFormatterOptions>;
  csv: Partial<CsvFormatterOptions>;
  json: Partial<JsonFormatterOptions>;
};

export type ReporterPluginOptions = {
  formatters?: Partial<Formatters>;
};

export type FormatterConstructor<T> = (logger: Logger) => Formatter<T>;

export type FormatterRegistryEntry<K extends keyof Formatters> = {
  factory: FormatterConstructor<Formatters[K]>;
  prepareOptions: <T = Formatters[K]>(
    options: Formatters[K],
    pluginOptions: { cwd: string; logger: Logger },
  ) => Formatters[K] | T;
};

/**
 * Resolve a formatter's output path against the run's `cwd`. A relative
 * configured path is anchored to `cwd`; an absolute one is kept as-is.
 */
function resolveOutputPath(
  cwd: string,
  configuredPath: string | undefined,
  defaultPath: string,
): string {
  return resolve(
    cwd,
    typeof configuredPath === 'string' ? configuredPath : defaultPath,
  );
}

export const FORMATTER_REGISTRY: {
  [K in keyof Formatters]: FormatterRegistryEntry<K>;
} = {
  markdown: {
    factory: (logger) => new MarkdownFormatter(logger),
    prepareOptions: (options, { cwd }) => ({
      ...options,
      path: resolveOutputPath(cwd, options.path, '.thymian/reports/report.md'),
    }),
  },
  csv: {
    factory: (logger) => new CsvFormatter(logger),
    prepareOptions: (options, { cwd }) => ({
      ...options,
      path: resolveOutputPath(cwd, options.path, '.thymian/reports/report.csv'),
    }),
  },
  json: {
    factory: (logger) => new JsonFormatter(logger),
    prepareOptions: (options, { cwd }) => ({
      ...options,
      path: resolveOutputPath(
        cwd,
        options.path,
        '.thymian/reports/report.json',
      ),
    }),
  },
} as const;

export function isValidFormatter(name: string): name is keyof Formatters {
  return Object.hasOwn(FORMATTER_REGISTRY, name);
}

export async function getFormatters(
  config: ReporterPluginOptions['formatters'] = {},
  cwd: string,
  logger: Logger,
  sortReportsBy?: SortReportsBy,
): Promise<Formatter[]> {
  return Promise.all(
    Object.entries(config).map(async ([name, options]) => {
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
        logger,
      });

      // we know that the options are valid, so we can safely cast them.
      // `sortReportsBy` rides along for every formatter; only markdown reads it.
      await formatter.init({ ...preparedOptions, sortReportsBy } as never);

      return formatter;
    }),
  );
}
