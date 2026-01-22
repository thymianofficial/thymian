import * as path from 'node:path';

import type {
  Logger,
  ThymianReport,
  ThymianReportSeverity,
} from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';

export const details = (details: string): string =>
  `
  <details>
  <summary>More details</summary>
  ${details}
  </details>`;

export function mapSeverityToBadge(severity: ThymianReportSeverity): string {
  if (severity === 'error') return '❌ ERROR';
  if (severity === 'warn') return '⚠️ WARN';
  if (severity === 'hint') return '💡 HINT';
  return 'ℹ️ INFO';
}

export type MarkdownFormatterOptions = {
  path: string;
};

export class MarkdownFormatter implements Formatter<MarkdownFormatterOptions> {
  options!: MarkdownFormatterOptions;

  private readonly reports: ThymianReport[] = [];

  constructor(private readonly logger: Logger) {}

  init(options: MarkdownFormatterOptions): void {
    this.options = options;
  }

  report(report: ThymianReport): void | Promise<void> {
    this.reports.push(report);
  }

  async flush(): Promise<void> {
    if (this.reports.length === 0) return;

    const analysis = analyze(this.reports);

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
            const sev = mapSeverityToBadge(report.severity);
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

    await mkdir(path.dirname(this.options.path), { recursive: true });

    await writeFile(this.options.path, lines.join('\n'), 'utf-8');

    this.logger.debug(`Wrote Markdown report to ${this.options.path}.`);
  }
}
