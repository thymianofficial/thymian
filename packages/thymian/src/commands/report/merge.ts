import {
  BaseCliRunCommand,
  reportFlag,
  runReportAssembly,
} from '@thymian/common-cli';
import type { ReportInput, SpecificationInput } from '@thymian/core';
import type {} from '@thymian/plugin-reporter';

export default class ReportMerge extends BaseCliRunCommand<typeof ReportMerge> {
  static override description =
    'Merge multiple reports — Thymian JSON reports or convertible external formats — into one Thymian report.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --report thymian:./a.json --report thymian:./b.json',
    '<%= config.bin %> <%= command.id %> --report thymian:./thymian-report.json --report spectral:./spectral-report.json --spec openapi:./api.yaml',
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
    // Report inputs are CLI-only for merge (ADR-0020, #362 review decision):
    // the config `reports` key never feeds a merge, so a config entry can't
    // silently widen or alter an explicit merge request. Specifications keep
    // the normal resolution chain.
    const reports: ReportInput[] = this.flags.report ?? [];
    // Config AND CLI: `--spec` is a base flag, and Step C (see
    // BaseCliRunCommand) has already folded it over the config's
    // `specifications` before run() — this line carries both sources,
    // flags winning, like every other command.
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
      'No report input found. Provide one with --report.',
    );
  }
}
