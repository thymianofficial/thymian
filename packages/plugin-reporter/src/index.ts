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
          text: {
            nullable: true,
            description: 'Configuration for the text (console) formatter',
            type: 'object',
            properties: {
              summaryOnly: {
                description:
                  'When true, only shows the summary without detailed reports',
                type: 'boolean',
                nullable: true,
              },
              path: {
                description:
                  'File path where the plain text report will be saved (ANSI escape codes are stripped)',
                type: 'string',
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
    listensOn: ['core.report.flush'],
  },
  async plugin(emitter, logger, { formatters: userFormatters, cwd }) {
    const formatters = {
      text: {},
      ...userFormatters,
    };

    const reporters = await getFormatters(formatters, cwd, logger);

    emitter.on('core.report', async (report: ThymianReport) => {
      reporters.forEach((r) => r.report(report));
    });

    emitter.onAction('core.report.flush', async (_event, ctx) => {
      const results = await Promise.all(reporters.map(async (r) => r.flush()));

      // Collect text output from formatters that return strings (e.g. TextFormatter)
      const textParts = results.filter(
        (r): r is string => typeof r === 'string',
      );

      ctx.reply(textParts.length > 0 ? { text: textParts.join('\n') } : {});
    });
  },
};

export default reporterPlugin;
