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

  // Report inputs are CLI-only for merge (ADR-0019, #362 review decision):
  // the config `reports` key never feeds a merge, so a config entry can't
  // silently widen or alter an explicit merge request. Specifications keep
  // the normal resolution chain — Step C has already folded --spec over the
  // config's `specifications` by the time this runs.
  protected override resolveReportInputs(): {
    reports: ReportInput[];
    specification: SpecificationInput[];
  } {
    return {
      reports: this.flags.report ?? [],
      specification: this.thymianConfig.specifications ?? [],
    };
  }
}
