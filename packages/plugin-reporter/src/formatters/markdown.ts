import * as path from 'node:path';

import type {
  Logger,
  ThymianReport,
  ThymianReportSeverity,
} from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import { errorSymbol, hintSymbol, warnSymbol } from '../style.js';

export const details = (text: string): string =>
  `
  <details>
  <summary>More details</summary>
  ${text}
  </details>`;

export function mapSeverityToBadge(severity: ThymianReportSeverity): string {
  if (severity === 'error') {
    return `${errorSymbol} error`;
  }
  if (severity === 'warn') {
    return `${warnSymbol} warn`;
  }
  if (severity === 'hint') {
    return `${hintSymbol} hint`;
  }
  return 'info';
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

  report(report: ThymianReport): void {
    this.reports.push(report);
  }

  async flush(): Promise<string | undefined> {
    if (this.reports.length === 0) {
      return undefined;
    }

    const analysis = analyze(this.reports);

    const lines: string[] = [];
    lines.push('# Thymian Report');

    const { numberOfReports, numberOfItems, severityCounts } =
      analysis.statistics;

    lines.push(
      `A total of ${numberOfReports} reports with ${numberOfItems} items were found.`,
    );
    lines.push(
      `Of these there are ${severityCounts.error} errors, ${severityCounts.warn} warnings, ${severityCounts.hint} hints and ${severityCounts.info} infos.`,
    );
    lines.push('');

    for (const report of analysis.reports) {
      lines.push(`## ${report.source}`);
      lines.push('');

      if (report.message) {
        lines.push(`  ${report.message}`);
        lines.push('');
        lines.push('');
      }

      if (report.sections) {
        for (const section of report.sections) {
          lines.push(`### ${section.heading}`);
          lines.push('');

          for (const item of section.items) {
            const sev = mapSeverityToBadge(item.severity);
            lines.push(`- **${sev}**: ${item.message}`);

            if (item.ruleName) {
              lines.push(`<br/>  *Rule: ${item.ruleName}*`);
            }

            if (item.details) {
              lines.push(details(item.details));
            }

            if (item.links && item.links.length > 0) {
              lines.push('  Related links:');
              for (const link of item.links) {
                lines.push(`  - [${link.title ?? link.url}](${link.url})`);
              }
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

    return undefined;
  }
}
