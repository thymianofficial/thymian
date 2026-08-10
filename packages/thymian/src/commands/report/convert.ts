import {
  BaseCliRunCommand,
  handleWorkflowOutcome,
  reportFlag,
} from '@thymian/common-cli';
import type { ReportInput } from '@thymian/core';
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

  // Specs are optional for convert (spec-location mapping is best-effort);
  // skipping the spec resolution chain must not skip Step C, which still
  // applies --spec flag-over-config before run().
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

    const outcome = await this.thymian.run(() =>
      this.thymian.reportConvert({
        reports,
        specification: this.thymianConfig.specifications ?? [],
        validateSpecs: this.flags['validate-specs'],
      }),
    );

    // Claim enforcement (ADR-0017): a type is supported exactly when >=1
    // registered plugin claims it, so the supported list is derived from
    // this run's claims — before any report rendering.
    if (outcome.unclaimed.length > 0) {
      const formatInput = (input: ReportInput) =>
        `"${input.type}:${String(input.location)}"`;

      const supportedTypes = [
        ...new Set(
          reports
            .filter(
              (input) =>
                !outcome.unclaimed.some(
                  (unclaimed) =>
                    unclaimed.type === input.type &&
                    String(unclaimed.location) === String(input.location),
                ),
            )
            .map((input) => input.type),
        ),
      ];

      if (supportedTypes.length === 0) {
        this.error(
          `No converter plugin claimed any report input (${outcome.unclaimed.map(formatInput).join(', ')}).`,
          {
            exit: 2,
            suggestions: [
              'Is a converter plugin (e.g. @thymian/plugin-spectral) installed and autoloaded?',
            ],
          },
        );
      }

      // Support is a per-type property, but claiming happens per input: an
      // input can go unclaimed even though its type is supported (e.g. a
      // wrong location) — that case must not read as "unsupported type".
      const unsupported = outcome.unclaimed.filter(
        (input) => !supportedTypes.includes(input.type),
      );
      const unclaimedOfSupportedType = outcome.unclaimed.filter((input) =>
        supportedTypes.includes(input.type),
      );

      const problems: string[] = [];

      if (unsupported.length > 0) {
        problems.push(
          `No registered plugin claims report input${unsupported.length > 1 ? 's' : ''} ${unsupported.map(formatInput).join(', ')}.`,
        );
      }

      if (unclaimedOfSupportedType.length > 0) {
        const list = unclaimedOfSupportedType.map(formatInput).join(', ');
        problems.push(
          unclaimedOfSupportedType.length > 1
            ? `Report inputs ${list} have a supported type but were not claimed — check the locations.`
            : `Report input ${list} has a supported type but was not claimed — check the location.`,
        );
      }

      this.error(
        `${problems.join(' ')} Supported report types in this run: ${supportedTypes.join(', ')}.`,
        { exit: 2 },
      );
    }

    handleWorkflowOutcome(
      this,
      outcome.report,
      {},
      { sortReportsBy: this.flags['sort-reports-by'] },
    );
  }
}
