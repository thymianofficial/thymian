import { BaseReportAssemblyCommand } from '@thymian/common-cli';
import type { ReportInput, SpecificationInput } from '@thymian/core';
import type {} from '@thymian/plugin-spectral';

export default class ReportConvert extends BaseReportAssemblyCommand<
  typeof ReportConvert
> {
  static override description =
    'Convert external tool reports into a canonical Thymian report.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --report spectral:./report.json',
    '<%= config.bin %> <%= command.id %> --report spectral:./report.json --spec openapi:./api.yaml',
  ];

  protected override readonly noReportInputMessage =
    'No report input found. Provide one with --report or add reports to your configuration file.';

  // Flags-over-config for --report, mirroring Step C's --spec handling
  // (which has already folded --spec into thymianConfig.specifications by
  // the time this runs); resolved here because --report is command-level,
  // not a baseFlag.
  protected override resolveReportInputs(): {
    reports: ReportInput[];
    specification: SpecificationInput[];
  } {
    return {
      reports: this.flags.report?.length
        ? this.flags.report
        : (this.thymianConfig.reports ?? []),
      specification: this.thymianConfig.specifications ?? [],
    };
  }
}
