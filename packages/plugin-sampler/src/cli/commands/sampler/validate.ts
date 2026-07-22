import { BaseCliRunCommand, oclif } from '@thymian/common-cli';
import {
  type Severity,
  SEVERITY_COLORS,
  SEVERITY_SYMBOLS,
  successSymbol,
} from '@thymian/core';

import type {
  SamplerValidationContentChange,
  SamplerValidationFinding,
  SamplerValidationFindingType,
  SamplerValidationReport,
} from '../../../validation/validate-sampler-output.js';

const { colorize } = oclif.ux;

// Map each finding to a core report severity so the command reuses the exact
// colors and symbols of the Thymian report renderer (see report-style.ts)
// without constructing a Report. A missing/changed artifact is an error; an
// unexpected extra file is a warning.
const FINDING_SEVERITY: Record<SamplerValidationFindingType, Severity> = {
  'missing-artifact': 'error',
  'changed-artifact': 'error',
  'stale-root-metadata': 'error',
  'metadata-out-of-sync': 'error',
  'invalid-json': 'error',
  'unexpected-artifact': 'warn',
};

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override enableJsonFlag = true;

  static override description =
    'Validate generated sampler artifacts for the current API specification.';

  static override flags = {
    ['full-diffs']: oclif.Flags.boolean({
      default: false,
      description:
        'Show the full diff for every out-of-sync artifact instead of a summary.',
    }),
    ['for-path']: oclif.Flags.string({
      description:
        'Validate a single generated artifact by its relative path (e.g. meta.json) and show its full diff. Note: the full artifact set is still regenerated internally, so this scopes the output, not the work.',
    }),
  };

  async run(): Promise<SamplerValidationReport> {
    return this.thymian.run(async (emitter) => {
      if (
        !this.thymian.plugins.find(
          (p) => p.plugin.name === '@thymian/plugin-sampler',
        )
      ) {
        this.error(
          'Cannot validate sampler if sampler plugin is not registered.',
          {
            exit: 1,
          },
        );
      }

      const format = await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        {
          emitFormat: false,
        },
      );

      const forPath = this.flags['for-path'];

      const report = await emitter.emitAction(
        'sampler.validate',
        {
          format: format.export(),
          ...(forPath !== undefined ? { forPath } : {}),
        },
        {
          strategy: 'first',
        },
      );

      // A scoped run reports 0 checked artifacts only when the path is not a
      // known generated artifact — surface that as an error in every mode.
      if (forPath !== undefined && report.checkedArtifacts === 0) {
        if (this.jsonEnabled()) {
          // Keep machine output consistent: emit the (empty) report as JSON and
          // signal the usage error through the exit code instead of throwing,
          // which would abort before any JSON is printed.
          process.exitCode = 2;

          return report;
        }

        this.error(
          `No generated sampler artifact found at path "${forPath}".`,
          {
            exit: 2,
          },
        );
      }

      if (this.jsonEnabled()) {
        // oclif serializes the returned value as JSON and suppresses `this.log`.
        // Signal failure through the exit code without throwing, because a throw
        // would abort before the JSON is printed.
        if (report.failures.length > 0) {
          process.exitCode = 1;
        }

        return report;
      }

      if (report.failures.length === 0) {
        this.log(
          `${colorize(SEVERITY_COLORS.info, successSymbol)} ${
            forPath !== undefined
              ? `Generated sampler artifact "${forPath}" is in sync.`
              : `Sampler validation passed: ${report.checkedArtifacts} generated artifacts are in sync.`
          }`,
        );

        return report;
      }

      // `--for-path` targets one artifact, so its diff is always shown;
      // otherwise details are opt-in via `--full-diffs`.
      const showDiffs = this.flags['full-diffs'] || forPath !== undefined;

      for (const failure of report.failures) {
        this.logFailure(failure, showDiffs);
      }

      const checked = report.checkedArtifacts;
      // `checkedArtifacts` counts only expected (generated) artifacts, so keep
      // unexpected extras in their own tally — otherwise "N failed" against
      // "Checked M" reads as "N of M generated artifacts failed" when the extras
      // were never part of that set.
      const unexpected = report.failures.filter(
        (failure) => failure.type === 'unexpected-artifact',
      ).length;
      const outOfSync = report.failures.length - unexpected;

      const summaryParts: string[] = [];
      if (outOfSync > 0) {
        summaryParts.push(`${outOfSync} out of sync`);
      }
      if (unexpected > 0) {
        summaryParts.push(`${unexpected} unexpected`);
      }

      this.log();
      this.log(
        `Checked ${checked} generated ${checked === 1 ? 'artifact' : 'artifacts'} in ${report.samplePath}. ${colorize(SEVERITY_COLORS.error, `${summaryParts.join(', ')}.`)}`,
      );

      this.exit(1);
    });
  }

  private logFailure(
    failure: SamplerValidationFinding,
    showDiffs: boolean,
  ): void {
    const severity = FINDING_SEVERITY[failure.type];
    const color = SEVERITY_COLORS[severity];
    const symbol = SEVERITY_SYMBOLS[severity];

    this.log(
      `${colorize(color, `${symbol} ${failure.type}`)}: ${failure.path}`,
    );

    if (!showDiffs) {
      return;
    }

    this.log(colorize(SEVERITY_COLORS.info, `  ${failure.message}`));

    if (failure.changes && failure.changes.length > 0) {
      this.logJsonChanges(failure.changes);
    } else {
      this.logContentField('expected', failure.expected);
      this.logContentField('actual', failure.actual);
    }

    this.log();
  }

  private logJsonChanges(changes: SamplerValidationContentChange[]): void {
    this.log(colorize(SEVERITY_COLORS.info, '  JSON changes:'));

    for (const change of changes) {
      const pointer = change.pointer || '/';
      let detail: string;

      if (change.type === 'add') {
        detail = `[add] ${pointer} → ${JSON.stringify(change.actual)}`;
      } else if (change.type === 'delete') {
        detail = `[delete] ${pointer} (was ${JSON.stringify(change.expected)})`;
      } else {
        detail = `[update] ${pointer}: ${JSON.stringify(change.expected)} → ${JSON.stringify(change.actual)}`;
      }

      this.log(colorize(SEVERITY_COLORS.info, `    ${detail}`));
    }
  }

  private logContentField(
    label: 'expected' | 'actual',
    value: string | undefined,
  ): void {
    if (value === undefined) {
      return;
    }

    this.log(colorize(SEVERITY_COLORS.info, `  ${label}:`));

    for (const line of value.split('\n')) {
      this.log(colorize(SEVERITY_COLORS.info, `    ${line}`));
    }
  }
}
