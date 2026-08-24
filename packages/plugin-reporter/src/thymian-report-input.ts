import type {
  ConvertedRunFragment,
  Logger,
  ThymianEmitter,
} from '@thymian/core';
import { registerReportInputClaim, ThymianBaseError } from '@thymian/core';

import { loadThymianReports } from './load-thymian-report.js';

/**
 * Registers the native `thymian:` report-input claim: reads persisted Thymian
 * JSON reports (this package's JSON formatter's output — a report **array** —
 * or a bare single report object) back into the report pipeline, making
 * `@thymian/plugin-reporter` the owner of the persisted-report file boundary
 * in both directions (ADR-0017 amendment). The listener skeleton and file
 * boundary live in core's `registerReportInputClaim`/`readTypedInputJson`
 * (shared by every claimant); this claim replies **one fragment per
 * `ToolRun`** found, passing runs through unchanged (identity preserved — no
 * re-minting) and carrying each source report's `thymianFormat` map so
 * persisted `thymianFormat` locations stay resolvable after a merge (#507).
 */
export function registerThymianReportInput(
  emitter: ThymianEmitter,
  logger: Logger,
  cwd: string,
): void {
  registerReportInputClaim(emitter, logger, {
    type: 'thymian',
    idleMessage: 'No thymian report inputs found, nothing to read.',
    convert: async (inputs) => {
      const fragments: ConvertedRunFragment[] = [];

      for (const { location, inputLabel } of inputs) {
        logger.info(`Reading Thymian report: ${location}`);

        // Failures propagate as thrown ThymianBaseErrors — the intended
        // tool/runtime error semantics; never a silently dropped input.
        const reports = await loadThymianReports(location, inputLabel, cwd);

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
              input: { type: 'thymian', location },
              // The persisted run passes through as-is; the source
              // report's format map rides along on every fragment (core
              // unions duplicates by hash, first occurrence wins).
              run,
              thymianFormat: report.thymianFormat,
            });
          }
        }
      }

      return fragments;
    },
  });
}
