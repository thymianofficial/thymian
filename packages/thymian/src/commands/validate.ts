import {
  BaseCliRunCommand,
  classificationToExitCode,
} from '@thymian/common-cli';
import { ux } from '@thymian/common-cli/oclif';
import type {
  SpecValidationIssue,
  SpecValidationOutcome,
  SpecValidationResult,
} from '@thymian/core';
import type {} from '@thymian/plugin-openapi';
import type {} from '@thymian/plugin-reporter';
import type {} from '@thymian/plugin-sampler';
import type {} from '@thymian/plugin-websocket-proxy';

function sanitizeForOutput(value: string): string {
  return value.replaceAll(/\r?\n/g, ' ');
}

function summarizeIssues(issues: SpecValidationIssue[]): string {
  if (issues.length === 0) {
    return 'valid';
  }

  const [firstIssue] = issues;
  const suffix = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
  const pathSuffix = firstIssue?.path ? ` @ ${firstIssue.path}` : '';
  return `${sanitizeForOutput(firstIssue?.message ?? 'validation failed')}${pathSuffix}${suffix}`;
}

function renderSummary(outcome: SpecValidationOutcome): string[] {
  const total = outcome.results.length;
  const valid = outcome.results.filter(
    (result) => result.status === 'success',
  ).length;
  const invalid = outcome.results.filter(
    (result) => result.status === 'failed',
  ).length;
  const unsupported = outcome.results.filter(
    (result) => result.status === 'unsupported',
  ).length;
  const errors = outcome.results.filter(
    (result) => result.status === 'error',
  ).length;

  return [
    'Specification validation summary',
    `  Total: ${total}`,
    `  Valid: ${valid}`,
    `  Invalid: ${invalid}`,
    `  Unsupported: ${unsupported}`,
    `  Errors: ${errors}`,
  ];
}

function renderResult(result: SpecValidationResult): string[] {
  const icon =
    result.status === 'success' ? '✓' : result.status === 'failed' ? '✖' : '⚠';
  const lines = [
    `${icon} ${result.type}:${result.location}`,
    `  Source: ${sanitizeForOutput(result.source)}`,
  ];

  if (result.issues.length === 0) {
    lines.push('  Result: valid');
    return lines;
  }

  lines.push(`  Result: ${summarizeIssues(result.issues)}`);

  for (const issue of result.issues) {
    const pathSuffix = issue.path ? ` (${issue.path})` : '';
    lines.push(`    - ${sanitizeForOutput(issue.message)}${pathSuffix}`);
  }

  return lines;
}

function formatSpecValidationOutcome(outcome: SpecValidationOutcome): string {
  return [
    ...renderSummary(outcome),
    '',
    ...outcome.results.flatMap(renderResult),
  ].join('\n');
}

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override description =
    'Validate API specifications resolved from config or --spec.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --spec openapi:./openapi.yaml',
  ];

  override async run(): Promise<void> {
    const specifications = this.thymianConfig.specifications ?? [];

    if (specifications.length === 0) {
      this.error(
        'No specification found. Provide a specification with --spec or create a configuration file.',
        {
          exit: 2,
        },
      );
    }

    const outcome = await this.thymian.run(async () => {
      return await this.thymian.validate({
        specification: specifications,
      });
    });

    const exitCode = classificationToExitCode(outcome.classification);

    for (const result of outcome.results) {
      const icon =
        result.status === 'success'
          ? '✓'
          : result.status === 'failed'
            ? '✖'
            : '⚠';

      ux.stdout(`${icon} ${result.location}`);

      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          ux.stdout(
            `    - ${issue.message}${issue.path ? ` (at ${issue.path})` : ''}`,
          );
        }
        ux.stdout();
      }
    }

    if (exitCode === 0) {
      ux.stdout('All specifications are valid.');
    } else if (exitCode === 1) {
      ux.stdout(
        `\n${outcome.results.filter((r) => r.status === 'failed').length} of ${specifications.length} specifications are invalid.`,
      );
    } else {
      ux.stdout(
        `\n${outcome.results.filter((r) => r.status === 'unsupported' || r.status === 'error').length} of ${specifications.length} specifications could not be validated.`,
      );
    }

    this.exit(exitCode);
  }
}
