import { join } from 'node:path';

import { type Logger, ThymianBaseError } from '@thymian/core';

import type { Formatter } from './formatter.js';
import { CliFormatter, type CliFormatterOptions } from './formatters/cli.js';
import { CsvFormatter, type CsvFormatterOptions } from './formatters/csv.js';
import {
  MarkdownFormatter,
  type MarkdownFormatterOptions,
} from './formatters/markdown.js';

export type Formatters = {
  cli: Partial<CliFormatterOptions>;
  markdown: Partial<MarkdownFormatterOptions>;
  csv: Partial<CsvFormatterOptions>;
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

export const FORMATTER_REGISTRY: {
  [K in keyof Formatters]: FormatterRegistryEntry<K>;
} = {
  cli: {
    factory: () => new CliFormatter(),
    prepareOptions: (options) => ({
      summaryOnly: false,
      ...options,
    }),
  },
  markdown: {
    factory: (logger) => new MarkdownFormatter(logger),
    prepareOptions: (options, pluginOptions) => ({
      path: join(
        pluginOptions.cwd,
        typeof options.path === 'string'
          ? options.path
          : '.thymian/reports/report.md',
      ),
      ...options,
    }),
  },
  csv: {
    factory: (logger) => new CsvFormatter(logger),
    prepareOptions: (options, { cwd }) => ({
      path: join(
        cwd,
        typeof options.path === 'string'
          ? options.path
          : '.thymian/reports/report.csv',
      ),
      ...options,
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

      // we know that the options are valid, so we can safely cast them
      await formatter.init(preparedOptions as never);

      return formatter;
    }),
  );
}
