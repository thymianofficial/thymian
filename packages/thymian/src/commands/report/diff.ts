import type { FailOnMode } from '@thymian/common-cli';
import {
  BaseCliRunCommand,
  enforceReportClaims,
  FAIL_ON_VALUES,
  oclif,
  parseTypedInput,
  renderReportDiffSummary,
  reportDiffGateFails,
} from '@thymian/common-cli';
import type { ReportInput } from '@thymian/core';
import type {} from '@thymian/plugin-reporter';

const TYPED_INPUT_EXAMPLE = 'thymian:./report.json';

/**
 * Only `thymian` inputs are diffable for now: a persisted Thymian report
 * embeds the Thymian format graph(s) it was produced against, and that
 * report↔specification linkage is what specification comparison and
 * location pairing are built on. Foreign formats (e.g. spectral) lack it —
 * convert or merge them into a Thymian report first (#502).
 */
const SUPPORTED_DIFF_TYPE = 'thymian';

export default class ReportDiff extends BaseCliRunCommand<typeof ReportDiff> {
  static override description =
    'Compare two Thymian reports and write out the difference: new and resolved findings, specification changes, and rule changes.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> --base thymian:./before.json --head thymian:./after.json',
    '<%= config.bin %> <%= command.id %> --base thymian:./before.json --head thymian:./after.json --json',
    '<%= config.bin %> <%= command.id %> --base thymian:./before.json --head thymian:./after.json --fail-on regression',
  ];

  // Diffing operates on already-existing reports; no specification input is
  // involved (the embedded format graphs are read from the reports).
  static override requiresSpecifications = false;

  static override flags = {
    base: oclif.Flags.custom<ReportInput>({
      description: `The old/reference report in the format <type>:<file-path> (only "${SUPPORTED_DIFF_TYPE}" is supported for now).`,
      helpValue: 'thymian:./base.json',
      required: true,
      parse: async (input) =>
        parseTypedInput(input, '--base', TYPED_INPUT_EXAMPLE),
    })(),
    head: oclif.Flags.custom<ReportInput>({
      description: `The new/compared report in the format <type>:<file-path> (only "${SUPPORTED_DIFF_TYPE}" is supported for now).`,
      helpValue: 'thymian:./head.json',
      required: true,
      parse: async (input) =>
        parseTypedInput(input, '--head', TYPED_INPUT_EXAMPLE),
    })(),
    'fail-on': oclif.Flags.custom<FailOnMode>({
      description:
        'When the exit code reports a failure (exit 1): "none" (default) never — the diff is informational unless you opt in; "regression" on any new run result regardless of severity; "error" only on new error-severity run results; "any-change" on any change at all. The gate classifies diff changes, not report executions.',
      options: [...FAIL_ON_VALUES],
      default: 'none',
    })(),
    json: oclif.Flags.boolean({
      description:
        'Print the machine-readable diff document (JSON) instead of the compact summary.',
      default: false,
    }),
  };

  override async run(): Promise<void> {
    const inputs: { flagName: '--base' | '--head'; input: ReportInput }[] = [
      { flagName: '--base', input: this.flags.base },
      { flagName: '--head', input: this.flags.head },
    ];

    // Report inputs are CLI-only (ADR-0020) and Thymian-only for now — the
    // restriction lives here at the command boundary; the claim layer stays
    // generic (#502 AC 2).
    for (const { flagName, input } of inputs) {
      if (input.type !== SUPPORTED_DIFF_TYPE) {
        this.error(
          `Unsupported report type "${input.type}" for ${flagName}: only "${SUPPORTED_DIFF_TYPE}" reports can be diffed for now — foreign formats lack the embedded Thymian format linkage the diff is built on. Convert or merge the input into a Thymian report first (thymian report convert / merge).`,
          { exit: 2 },
        );
      }
    }

    const outcome = await this.thymian.run(() =>
      this.thymian.reportDiff({
        base: this.flags.base,
        head: this.flags.head,
      }),
    );

    enforceReportClaims(
      this,
      inputs.map(({ input }) => input),
      outcome.unclaimed,
    );

    // enforceReportClaims exits on unclaimed inputs, so the diff exists here.
    const diff = outcome.diff!;
    const failOn = this.flags['fail-on'] ?? 'none';

    oclif.ux.stdout(
      this.flags.json
        ? JSON.stringify(diff, null, 2)
        : renderReportDiffSummary(diff, { failOn }),
    );

    if (reportDiffGateFails(diff.changes, failOn)) {
      this.exit(1);
    }
  }
}
