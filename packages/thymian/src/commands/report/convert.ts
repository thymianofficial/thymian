import {
  BaseCliRunCommand,
  reportFlag,
  runReportAssembly,
} from '@thymian/common-cli';
import type { ReportInput, SpecificationInput } from '@thymian/core';
import type {} from '@thymian/plugin-spectral';

export default class ReportConvert extends BaseCliRunCommand<
  typeof ReportConvert
> {
  static override description =
    'Convert external tool reports into a canonical Thymian report.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --report spectral:./report.json',
    '<%= config.bin %> <%= command.id %> --report spectral:./report.json --spec openapi:./api.yaml',
  ];

  static override flags = {
    report: reportFlag(),
  };

  // Specs are optional for report assembly: they are only needed when a
  // foreign input (e.g. spectral) should map onto format nodes during
  // conversion, so the spec resolution chain (Steps C–F) must not gate the
  // command.
  static override requiresSpecifications = false;

  override async run(): Promise<void> {
    // Flags-over-config for --report, mirroring Step C's --spec handling
    // (which has already folded --spec into thymianConfig.specifications by
    // the time this runs); resolved here because --report is command-level,
    // not a baseFlag.
    const reports: ReportInput[] = this.flags.report?.length
      ? this.flags.report
      : (this.thymianConfig.reports ?? []);
    const specification: SpecificationInput[] =
      this.thymianConfig.specifications ?? [];

    await runReportAssembly(
      this,
      {
        thymian: this.thymian,
        reports,
        specification,
        validateSpecs: this.flags['validate-specs'],
        sortReportsBy: this.flags['sort-reports-by'],
      },
      'No report input found. Provide one with --report or add reports to your configuration file.',
    );
  }
}
