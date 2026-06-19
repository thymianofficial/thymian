import * as path from 'node:path';

import type { Logger, Report, Severity } from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import { errorSymbol, hintSymbol, warnSymbol } from '../style.js';

export const details = (text: string): string =>
  `\n<details>\n<summary>More details</summary>\n${text}\n</details>`;

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

function formatLocation(
  location: NonNullable<
    Report['runs'][number]['executions']
  >[number]['location'],
): string {
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

    const analysis = analyze(this.reports);
    const lines: string[] = [];
    lines.push('# Thymian Report');
    lines.push('');
    lines.push(
      `Generated from ${analysis.statistics.numberOfReports} report(s), ${analysis.statistics.numberOfRuns} run(s), and ${analysis.statistics.numberOfFindings} finding(s).`,
    );
    lines.push('');

    for (const report of this.reports) {
      lines.push(`## Report ${report.reportId}`);
      lines.push('');

      for (const run of report.runs) {
        lines.push(`### ${run.tool.name} (${run.runType})`);
        lines.push('');
        lines.push('| Location | Severity | Kind | Title | Rule | Message |');
        lines.push('| --- | --- | --- | --- | --- | --- |');

        for (const execution of run.executions ?? []) {
          for (const finding of execution.findings) {
            lines.push(
              `| ${formatLocation(execution.location)} | ${mapSeverityToBadge(finding.severity)} | ${finding.kind} | ${finding.title} | ${'ruleId' in finding ? finding.ruleId : ''} | ${(finding.message?.text ?? '').replaceAll('|', '\\|')} |`,
            );
          }
        }

        lines.push('');
      }
    }

    await mkdir(path.dirname(this.options.path), { recursive: true });
    await writeFile(this.options.path, lines.join('\n'), 'utf-8');
    this.logger.debug(`Wrote Markdown report to ${this.options.path}.`);

    return undefined;
  }
}
