import type { Command } from '@oclif/core';
import type { ReportInput, SpecificationInput } from '@thymian/core';

import { BaseCliRunCommand } from './base-cli-run-command.js';
import { reportFlag } from './flags/report-flag.js';
import { enforceReportClaims } from './report-claim-enforcement.js';
import { handleWorkflowOutcome } from './workflow-outcome.js';

/**
 * Shared spine of the report-assembly commands (`thymian report convert` /
 * `thymian report merge`): resolve the report and spec inputs (the one place
 * the two commands deliberately differ — see {@link resolveReportInputs}),
 * fail usage-style on an empty input set, run the core convert workflow,
 * enforce input claims (ADR-0017), and hand the outcome to the standard
 * renderer/exit-code path. Extracted so behavior and user-visible wording
 * can't silently drift between the two commands (#507 review).
 */
export abstract class BaseReportAssemblyCommand<
  T extends typeof Command,
> extends BaseCliRunCommand<T> {
  // Specs are optional for report assembly: they are only needed when a
  // foreign input (e.g. spectral) should map onto format nodes during
  // conversion, so the spec resolution chain (Steps C–F) must not gate the
  // command.
  static override requiresSpecifications = false;

  static override flags = {
    report: reportFlag(),
  };

  /**
   * Where this command's report inputs and specifications come from.
   * Specifications follow the normal flags-over-config chain everywhere;
   * report inputs differ: convert reads `--report` flags over the config
   * `reports` key, merge reads `--report` flags only (ADR-0020).
   */
  protected abstract resolveReportInputs(): {
    reports: ReportInput[];
    specification: SpecificationInput[];
  };

  /** Usage error shown when input resolution produced no report inputs. */
  protected abstract readonly noReportInputMessage: string;

  override async run(): Promise<void> {
    const { reports, specification } = this.resolveReportInputs();

    if (reports.length === 0) {
      this.error(this.noReportInputMessage, { exit: 2 });
    }

    const outcome = await this.thymian.run(() =>
      this.thymian.reportConvert({
        reports,
        specification,
        validateSpecs: this.flags['validate-specs'],
      }),
    );

    enforceReportClaims(this, reports, outcome.unclaimed);

    handleWorkflowOutcome(
      this,
      outcome.report,
      {},
      { sortReportsBy: this.flags['sort-reports-by'] },
    );
  }
}
