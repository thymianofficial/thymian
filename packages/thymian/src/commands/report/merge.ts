import { BaseReportAssemblyCommand } from '@thymian/common-cli';
import type { ReportInput, SpecificationInput } from '@thymian/core';
import type {} from '@thymian/plugin-reporter';

export default class ReportMerge extends BaseReportAssemblyCommand<
  typeof ReportMerge
> {
  static override description =
    'Merge multiple reports — Thymian JSON reports or convertible external formats — into one Thymian report.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --report thymian:./a.json --report thymian:./b.json',
    '<%= config.bin %> <%= command.id %> --report thymian:./thymian-report.json --report spectral:./spectral-report.json --spec openapi:./api.yaml',
  ];

  protected override readonly noReportInputMessage =
    'No report input found. Provide one with --report.';

  // Merge reads its inputs from CLI arguments only (#362 review decision):
  // neither config `reports` nor config `specifications` feed a merge, so a
  // config key can't silently widen or alter an explicit merge request.
  // General config (plugins, formatters, log level) still applies.
  protected override resolveReportInputs(): {
    reports: ReportInput[];
    specification: SpecificationInput[];
  } {
    return {
      reports: this.flags.report ?? [],
      specification: this.flags.spec ?? [],
    };
  }
}
