import { join } from 'node:path';

import {
  ThymianBaseError,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';

import { Formatter } from './formatter.js';
import { CliFormatter, type CliFormatterOptions } from './formatters/cli.js';
import {
  MarkdownFormatter,
  type MarkdownFormatterOptions,
} from './formatters/markdown.js';

export type ReporterPluginOptions = {
  formatters?: {
    cli?: CliFormatterOptions;
    markdown?: MarkdownFormatterOptions;
  };
};

export async function getFormatters(
  config: ReporterPluginOptions['formatters'] = {},
  cwd: string,
): Promise<Formatter[]> {
  return Promise.all(
    Object.entries(config).map(([name, options]) => {
      if (name === 'cli') {
        return new CliFormatter().init(options);
      }

      if (name === 'markdown') {
        return new MarkdownFormatter().init({
          ...options,
          path: join(
            cwd,
            typeof options.path === 'string'
              ? options.path
              : 'thymian/reports/report.md',
          ),
        });
      }

      throw new ThymianBaseError(
        `Unknown formatter "${name}". Available formatters: cli, markdown.`,
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
  async plugin(emitter, _logger, { formatters, cwd }) {
    const reporters = await getFormatters(formatters, cwd);

    emitter.on('core.report', async (report: ThymianReport) => {
      reporters.forEach((r) => r.report(report));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      await Promise.all(reporters.map(async (r) => r.flush(true)));
      ctx.reply();
    });
  },
};

export default reporterPlugin;
