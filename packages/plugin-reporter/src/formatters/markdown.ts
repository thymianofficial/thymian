import * as path from 'node:path';

import type {
  Execution,
  Location,
  Logger,
  Report,
  Severity,
} from '@thymian/core';
import {
  buildRuleIndex,
  findingDetails,
  resolveExecutionSeverity,
  walkExecutions,
} from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import { errorSymbol, hintSymbol, warnSymbol } from '../style.js';

export const details = (text: string): string =>
  `\n<details>\n<summary>More details</summary>\n${text}\n</details>`;

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function mapSeverityToBadge(severity: Severity): string {
  if (severity === 'error') {
    return `${errorSymbol} error`;
  }
  if (severity === 'warn') {
    return `${warnSymbol} warning`;
  }
  if (severity === 'hint') {
    return `${hintSymbol} hint`;
  }
  return 'info';
}

function formatLocation(location: Location): string {
  switch (location.type) {
    case 'custom':
      return location.value;
    case 'file':
      return [location.path, location.line, location.column]
        .filter((part) => part !== undefined)
        .join(':');
    case 'url':
      return location.url;
    case 'thymianFormat':
      return `format:${location.elementId}${location.pointer ? `#${location.pointer}` : ''}`;
  }
}

/** Label identifying what an execution is about (location, or test case name). */
function executionLabel(execution: Execution): string {
  return execution.kind === 'test'
    ? execution.name
    : formatLocation(execution.location);
}

export type MarkdownFormatterOptions = {
  path: string;
};

export class MarkdownFormatter implements Formatter<MarkdownFormatterOptions> {
  options!: MarkdownFormatterOptions;

  private readonly reports: Report[] = [];

  constructor(private readonly logger: Logger) {}

  init(options: MarkdownFormatterOptions): void {
    this.options = options;
  }

  report(report: Report): void {
    this.reports.push(report);
  }

  async flush(): Promise<string | undefined> {
    if (this.reports.length === 0) {
      return undefined;
    }

    const analysis = analyze(this.reports, this.logger);
    const { error, warn, hint, info } = analysis.statistics.severityCounts;
    const lines: string[] = [];
    lines.push('# Thymian Report');
    lines.push('');
    lines.push(
      `Found ${error} error(s), ${warn} warning(s), ${hint} hint(s), and ${info} info finding(s).`,
    );
    lines.push('');

    for (const report of this.reports) {
      for (const run of report.runs) {
        lines.push(`## ${run.tool.name} (${run.runType})`);
        lines.push('');
        lines.push(
          '| Location | Rule | Status | Severity | Kind | Title | Message | Details |',
        );
        lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

        const ruleIndex = buildRuleIndex(run.rules);
        for (const { execution } of walkExecutions(run.executions)) {
          const severity = resolveExecutionSeverity(
            execution,
            ruleIndex,
            this.logger,
          );
          const status = execution.status;
          const statusReason =
            status.kind === 'passed' ? '' : (status.reason ?? '');
          const duration =
            status.kind !== 'skipped' &&
            status.durationMilliseconds !== undefined
              ? `duration: ${status.durationMilliseconds}ms`
              : '';

          lines.push(
            `| ${escapeCell(executionLabel(execution))} | ${escapeCell(execution.ruleId ?? '')} | ${status.kind} | ${severity ? mapSeverityToBadge(severity) : ''} |  |  | ${escapeCell(statusReason)} | ${escapeCell(duration)} |`,
          );

          const findingsWithLocation =
            execution.kind === 'test'
              ? execution.steps.flatMap((step) =>
                  step.findings.map((finding) => ({
                    finding,
                    location: formatLocation(step.location),
                  })),
                )
              : execution.findings.map((finding) => ({
                  finding,
                  location: formatLocation(execution.location),
                }));

          for (const { finding, location } of findingsWithLocation) {
            const detail = findingDetails(finding)
              .map((d) => `${d.label}: ${d.value}`)
              .join('; ');
            lines.push(
              `| ${escapeCell(location)} | ${escapeCell(execution.ruleId ?? '')} |  |  | ${finding.kind} | ${escapeCell(finding.title)} | ${escapeCell(finding.message?.text ?? '')} | ${escapeCell(detail)} |`,
            );
          }
        }

        lines.push('');
      }
    }

    const output = lines.join('\n');

    await mkdir(path.dirname(this.options.path), { recursive: true });
    await writeFile(this.options.path, output, 'utf-8');
    this.logger.debug(`Wrote Markdown report to ${this.options.path}.`);

    return output;
  }
}
