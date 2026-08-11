import type { ConvertedRunFragment, ThymianPlugin } from '@thymian/core';
import { ThymianBaseError } from '@thymian/core';

import { loadThymianReports } from './load-thymian-report.js';

/**
 * `@thymian/plugin-thymian-report` reads persisted Thymian JSON reports (the
 * `@thymian/plugin-reporter` JSON formatter's output — a report **array** —
 * or a bare single report object) back into the report pipeline. It claims
 * `thymian`-typed report inputs on the core-owned `core.report.convert`
 * collect action (ADR-0016/0017) and replies **one fragment per `ToolRun`**
 * found, passing runs through unchanged (identity preserved — no re-minting)
 * and carrying each source report's `thymianFormat` map so persisted
 * `thymianFormat` locations stay resolvable after a merge (#507).
 */
export function createThymianReportPlugin(
  pluginName = '@thymian/plugin-thymian-report',
): ThymianPlugin {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.report.convert'],
    },
    async plugin(emitter, logger, options) {
      emitter.onAction('core.report.convert', async (input, ctx) => {
        const thymianInputs = input.inputs.filter(
          (reportInput) => reportInput.type === 'thymian',
        );

        // Always reply, even with nothing claimed — the collect strategy
        // waits for every registered listener (14.1 listener contract).
        if (thymianInputs.length === 0) {
          logger.info('No thymian report inputs found, nothing to read.');
          ctx.reply([]);
          return;
        }

        const fragments: ConvertedRunFragment[] = [];

        for (const reportInput of thymianInputs) {
          const location = String(reportInput.location);
          const inputLabel = `${reportInput.type}:${location}`;

          logger.info(`Reading Thymian report: ${location}`);

          // Failures propagate as thrown ThymianBaseErrors — the intended
          // tool/runtime error semantics; never a silently dropped input.
          const reports = await loadThymianReports(
            location,
            inputLabel,
            options.cwd,
          );

          // A run-less input would yield zero fragments and surface as a
          // misleading "supported type but not claimed" usage error — name
          // the real problem instead.
          if (reports.every((report) => report.runs.length === 0)) {
            throw new ThymianBaseError(
              `Unsupported Thymian report "${inputLabel}": no report in this file contains any run — nothing to merge.`,
            );
          }

          for (const report of reports) {
            for (const run of report.runs) {
              fragments.push({
                // Tag with the stringified input identity — core derives
                // claim coverage by exact type + String(location) match.
                input: { type: reportInput.type, location },
                // The persisted run passes through as-is; the source
                // report's format map rides along on every fragment (core
                // unions duplicates by hash, first occurrence wins).
                run,
                thymianFormat: report.thymianFormat,
              });
            }
          }
        }

        ctx.reply(fragments);
      });
    },
  };
}

export const thymianReportPlugin = createThymianReportPlugin();

export default thymianReportPlugin;
