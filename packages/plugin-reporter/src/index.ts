import { type ThymianPlugin, type ThymianReport } from '@thymian/core';

import { type Formatters, getFormatters } from './get-formatters.js';

export type ReporterPluginOptions = {
  formatters?: Partial<Formatters>;
};

export const reporterPlugin: ThymianPlugin<ReporterPluginOptions> = {
  name: '@thymian/reporter',
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      formatters: {
        nullable: true,
        description: 'Configuration for different report formatters',
        type: 'object',
        properties: {
          cli: {
            nullable: true,
            description: 'Configuration for the CLI (console) formatter',
            type: 'object',
            properties: {
              summaryOnly: {
                description:
                  'When true, only shows the summary without detailed reports',
                type: 'boolean',
                nullable: true,
              },
            },
            additionalProperties: false,
          },
          markdown: {
            description: 'Configuration for the Markdown formatter',
            nullable: true,
            type: 'object',
            properties: {
              path: {
                description:
                  'File path where the markdown report will be saved',
                type: 'string',
                nullable: true,
              },
            },
            additionalProperties: false,
          },
          csv: {
            description: 'Configuration for the CSV formatter',
            nullable: true,
            type: 'object',
            properties: {
              path: {
                description: 'File path where the CSV report will be saved',
                type: 'string',
                nullable: true,
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
  },
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
