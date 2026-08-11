import {
  BaseCliRunCommand,
  enforceReportClaims,
  handleWorkflowOutcome,
  reportFlag,
} from '@thymian/common-cli';
import type { ReportInput } from '@thymian/core';
import type {} from '@thymian/plugin-thymian-report';

export default class ReportMerge extends BaseCliRunCommand<typeof ReportMerge> {
  static override description =
    'Merge multiple reports — Thymian JSON reports or convertible external formats — into one Thymian report.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --report thymian:./a.json --report thymian:./b.json',
    '<%= config.bin %> <%= command.id %> --report thymian:./thymian-report.json --report spectral:./spectral-report.json --spec openapi:./api.yaml',
  ];

  // Specs are optional for merge: they are only needed when a foreign input
  // (e.g. spectral) should map onto format nodes during conversion. Skipping
  // the spec resolution chain must not skip Step C, which still applies
  // --spec flag-over-config before run().
  static override requiresSpecifications = false;

  static override flags = {
    report: reportFlag(),
  };

  override async run(): Promise<void> {
    // Flags-over-config for --report, mirroring Step C's --spec handling;
    // resolved here because --report is command-level, not a baseFlag.
    const reports: ReportInput[] = this.flags.report?.length
      ? this.flags.report
      : (this.thymianConfig.reports ?? []);

    if (reports.length === 0) {
      this.error(
        'No report input found. Provide one with --report or add reports to your configuration file.',
        { exit: 2 },
      );
    }

    // Merge = convert-then-assemble: every input is normalized to ToolRuns
    // via core.report.convert (thymian: inputs pass through unchanged, with
    // their format maps; foreign inputs are converted, against --spec when
    // given) and core assembles exactly one Report in input order. A single
    // input is a valid identity merge; duplicates collapse in core.
    const outcome = await this.thymian.run(() =>
      this.thymian.reportConvert({
        reports,
        specification: this.thymianConfig.specifications ?? [],
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
