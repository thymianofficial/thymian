import { join } from 'node:path';

import {
  type Logger,
  ThymianBaseError,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';

import type { Formatter } from './formatter.js';
import { CliFormatter, type CliFormatterOptions } from './formatters/cli.js';
import { CsvFormatter, type CsvFormatterOptions } from './formatters/csv.js';
import {
  MarkdownFormatter,
  type MarkdownFormatterOptions,
} from './formatters/markdown.js';

export type ReporterPluginOptions = {
  formatters?: {
    cli?: CliFormatterOptions;
    markdown?: MarkdownFormatterOptions;
    csv?: CsvFormatterOptions;
  };
};

export async function getFormatters(
  config: ReporterPluginOptions['formatters'] = {},
  cwd: string,
  logger: Logger,
): Promise<Formatter[]> {
  return Promise.all(
    Object.entries(config).map(async ([name, options]) => {
      if (name === 'cli' && 'summaryOnly' in options) {
        const formatter = new CliFormatter();
        formatter.init(options);
        return formatter;
      }

      if (name === 'markdown' && 'path' in options) {
        const formatter = new MarkdownFormatter();

        formatter.init({
          ...options,
          path: join(
            cwd,
            typeof options.path === 'string'
              ? options.path
              : '.thymian/reports/report.md',
          ),
        });

        return formatter;
      }

      if (name === 'csv' && 'path' in options) {
        const formatter = new CsvFormatter();

        formatter.init({
          logger,
          ...options,
          path: join(
            cwd,
            typeof options.path === 'string'
              ? options.path
              : '.thymian/reports/report.csv',
          ),
        });

        return formatter;
      }

      throw new ThymianBaseError(
        `Unknown formatter "${name}". Available formatters: cli, markdown, csv.`,
        {
          suggestions: [
            'If you want to add your own formatter, implement a new plugin and listen on the `core.report` event and/or open a Github issue.',
          ],
        },
      );
    }),
  );
}

export const reporterPlugin: ThymianPlugin<ReporterPluginOptions> = {
  name: '@thymian/reporter',
  version: '0.x',
  events: {
    listensOn: ['core.report'],
  },
  actions: {
    listensOn: ['core.close'],
  },
  async plugin(emitter, logger, { formatters, cwd }) {
    const reporters = await getFormatters(formatters, cwd, logger);

    emitter.on('core.report', async (report: ThymianReport) => {
      reporters.forEach((r) => r.report(report));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      await Promise.all(reporters.map(async (r) => r.flush()));
      ctx.reply();
    });
  },
};

export default reporterPlugin;
