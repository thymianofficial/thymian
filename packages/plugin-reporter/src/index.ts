import {
  type Report,
  SORT_REPORTS_BY_VALUES,
  type SortReportsBy,
  type ThymianPlugin,
} from '@thymian/core';

import { type Formatters, getFormatters } from './get-formatters.js';

export type ReporterPluginOptions = {
  formatters?: Partial<Formatters>;
  /**
   * How report findings are grouped. Normally injected from the
   * `--sort-reports-by` CLI flag; only the markdown formatter honours it.
   */
  sortReportsBy?: SortReportsBy;
  /**
   * Base directory every report's own run directory is created under. A
   * relative path resolves against the run's `cwd`, an absolute one is used
   * as-is. Defaults to `.thymian/reports`.
   *
   * `null` means unset, exactly like omitting the option: an optional property
   * in an Ajv `JSONSchemaType` must be declared `nullable: true`, and a YAML
   * `reportsDir:` with no value parses to `null` rather than to a string.
   */
  reportsDir?: string | null;
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
            additionalProperties: false,
          },
          csv: {
            description: 'Configuration for the CSV formatter',
            nullable: true,
            type: 'object',
            additionalProperties: false,
          },
          json: {
            description:
              'Configuration for the JSON formatter, which writes the canonical report payload for machine consumption',
            nullable: true,
            type: 'object',
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
      reportsDir: {
        description:
          'Base directory report output is written under. A relative path resolves against the run working directory, an absolute one is used as-is. Defaults to .thymian/reports. Every report gets its own directory beneath it, named <createdAt>-<reportId prefix>, holding one report.<ext> per configured formatter — so consecutive runs never overwrite each other and every format of one run stays together. CI should glob <reportsDir>/*/report.<ext>.',
        nullable: true,
        type: 'string',
        // A blank base would resolve to the run working directory itself and
        // scatter timestamped run directories through the user's project, so
        // it is rejected here rather than silently defaulted.
        minLength: 1,
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
  async plugin(
    emitter,
    logger,
    { formatters: userFormatters, cwd, sortReportsBy, reportsDir },
  ) {
    const formatters = Object.fromEntries(
      Object.entries({
        ...(userFormatters ?? {}),
      }).filter(([, options]) => options != null),
    ) as Formatters;

    // `null` is what a YAML `reportsDir:` with no value parses to, and the
    // schema has to admit it (an optional property must be `nullable: true`).
    // It means "unset" — normalized once, here, so nothing downstream has to
    // know that the option can arrive as anything but a string.
    const reportsBase = reportsDir ?? undefined;

    let hasFlushed = false;
    // One plugin instance serves the whole session, so `serve` keeps a single
    // set of formatters for every workflow it runs. Each formatter resolves a
    // destination per `core.report`, so one session still yields one run
    // directory per report rather than one aggregate named after the first.
    const reporters = await getFormatters(
      formatters,
      cwd,
      logger,
      sortReportsBy,
      reportsBase,
    );

    const flushReporters = async (): Promise<void> => {
      if (hasFlushed) {
        return;
      }

      hasFlushed = true;
      await Promise.all(reporters.map(async (r) => r.flush()));
    };

    emitter.on('core.report', async (report: Report) => {
      await Promise.all(reporters.map(async (r) => r.report(report)));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      try {
        await flushReporters();
      } finally {
        // The action must be answered even when a formatter cannot write its
        // file, otherwise `core.close` waits on a reply that never comes. The
        // failure still propagates to the emitter's error channel.
        ctx.reply();
      }
    });
  },
};

export default reporterPlugin;
