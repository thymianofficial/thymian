import {
  type Report,
  SORT_REPORTS_BY_VALUES,
  type SortReportsBy,
  type ThymianPlugin,
} from '@thymian/core';

import { type Formatters, getFormatters } from './get-formatters.js';
import { registerThymianReportInput } from './thymian-report-input.js';

export type ReporterPluginOptions = {
  formatters?: Partial<Formatters>;
  /**
   * How report findings are grouped. Normally injected from the
   * `--sort-reports-by` CLI flag; only the markdown formatter honours it.
   */
  sortReportsBy?: SortReportsBy;
};

export const reporterPlugin: ThymianPlugin<ReporterPluginOptions> = {
  name: '@thymian/plugin-reporter',
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      formatters: {
        nullable: true,
        description: 'Configuration for different report formatters',
        type: 'object',
        properties: {
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
          json: {
            description:
              'Configuration for the JSON formatter, which writes the canonical report payload for machine consumption',
            nullable: true,
            type: 'object',
            properties: {
              path: {
                description: 'File path where the JSON report will be saved',
                type: 'string',
                nullable: true,
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      sortReportsBy: {
        description:
          'How report findings are grouped (rule, endpoint, or severity). Normally set from the --sort-reports-by CLI flag; affects the markdown formatter only.',
        nullable: true,
        type: 'string',
        enum: [...SORT_REPORTS_BY_VALUES],
      },
    },
  },
  version: '0.x',
  events: {
    listensOn: ['core.report'],
  },
  actions: {
    listensOn: ['core.close', 'core.report.convert'],
  },
  async plugin(
    emitter,
    logger,
    { formatters: userFormatters, cwd, sortReportsBy },
  ) {
    // Read side of the persisted-report file boundary: claim native
    // `thymian:` report inputs on core.report.convert (ADR-0017 amendment).
    // Registered before the first await so the declared listener exists even
    // if formatter setup rejects.
    registerThymianReportInput(emitter, logger, cwd);

    const formatters = Object.fromEntries(
      Object.entries({
        ...(userFormatters ?? {}),
      }).filter(([, options]) => options != null),
    ) as Formatters;

    let hasFlushed = false;
    const reporters = await getFormatters(
      formatters,
      cwd,
      logger,
      sortReportsBy,
    );

    const flushReporters = async (): Promise<void> => {
      if (hasFlushed) {
        return;
      }

      hasFlushed = true;

      // allSettled, not all: one formatter's failure (e.g. an unwritable
      // --csv path) must not cut the sibling flushes short — their writes
      // would otherwise race process exit (#362 review). The first failure
      // is re-thrown afterwards; the emitter forwards a thrown core.close
      // handler error as a correlated error event, so the action fails fast
      // instead of waiting out a missing reply.
      const settled = await Promise.allSettled(
        reporters.map(async (r) => r.flush()),
      );
      const failures = settled.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      if (failures.length > 0) {
        for (const failure of failures.slice(1)) {
          logger.error(
            failure.reason instanceof Error
              ? failure.reason.message
              : String(failure.reason),
          );
        }

        throw failures[0]!.reason;
      }
    };

    emitter.on('core.report', async (report: Report) => {
      await Promise.all(reporters.map(async (r) => r.report(report)));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      await flushReporters();
      ctx.reply();
    });
  },
};

export default reporterPlugin;
