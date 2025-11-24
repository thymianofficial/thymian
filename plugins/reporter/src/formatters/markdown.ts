import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import { writeFile } from 'fs/promises';

import { Formatter } from '../formatter.js';

export type MarkdownFormatterOptions = {
  path: string;
};

export const details = (details: string): string =>
  `
  <details>
  <summary>More details</summary>
  ${details}
  </details>`;

export class MarkdownFormatter extends Formatter<MarkdownFormatterOptions> {
  private readonly reports: ThymianReport[] = [];

  private mapSeverityToBadge(severity: ThymianReportSeverity): string {
    if (severity === 'error') return '❌ ERROR';
    if (severity === 'warn') return '⚠️ WARN';
    if (severity === 'hint') return '💡 HINT';
    return 'ℹ️ INFO';
  }

  report(report: ThymianReport): void | Promise<void> {
    this.reports.push(report);
  }

  async flush(): Promise<void> {
    if (this.reports.length === 0) return;

    const analysis = this.analyze(this.reports);

    const lines: string[] = [];
    lines.push('# Thymian Report');

    const { numberOfReports, severityCounts } = analysis.statistics;

    lines.push('A total of ' + numberOfReports + ' reports were found.');
    lines.push(
      `Of these there are ${severityCounts.error} errors, ${severityCounts.warn} warnings, and ${severityCounts.hint} hints and ${severityCounts.info} infos.`,
    );
    lines.push('');

    for (const [producer, categories] of Object.entries(analysis.normalized)) {
      lines.push(`## ${producer}`);
      lines.push('');

      for (const [category, titles] of Object.entries(categories)) {
        lines.push(`### ${category}`);
        lines.push('');

        for (const [title, reports] of Object.entries(titles)) {
          lines.push(`#### ${title}`);
          lines.push('');

          for (const report of reports) {
            const sev = this.mapSeverityToBadge(report.severity);
            const src = report.source ? `\n   — *${report.source}*` : '';
            lines.push(`- ${sev}: ${report.summary}${src}`);

            if (report.details) {
              lines.push(details(report.details));
            }
          }

          lines.push('');
        }
      }

      lines.push('');
    }

    await writeFile(this.options.path, lines.join('\n'), 'utf-8');
  }
}
