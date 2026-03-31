import * as path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import { errorSymbol, hintSymbol, warnSymbol } from '../style.js';

export function formatSeverityPrefix(severity: ThymianReportSeverity): string {
  if (severity === 'hint') {
    return `${chalk.blue(`${hintSymbol} ${severity}`)}: `;
  }
  if (severity === 'warn') {
    return `${chalk.yellow(`${warnSymbol} ${severity}`)}: `;
  }
  if (severity === 'error') {
    return `${chalk.red(`${errorSymbol} ${severity}`)}: `;
  }

  return '';
}

export type TextFormatterOptions = {
  summaryOnly: boolean;
  path?: string;
};

export class TextFormatter implements Formatter<Partial<TextFormatterOptions>> {
  options!: TextFormatterOptions;

  private readonly reports: ThymianReport[] = [];

  init(options: Partial<TextFormatterOptions>): void {
    this.options = {
      summaryOnly: false,
      ...options,
    };
  }

  async flush(): Promise<string | undefined> {
    if (this.reports.length === 0) {
      return undefined;
    }

    const analysis = analyze(this.reports);
    const lines: string[] = [];

    if (!this.options.summaryOnly) {
      for (const report of analysis.reports) {
        lines.push(
          `${report.source} ${Array.from({
            length: Math.max(1, 80 - report.source.length),
          })
            .map(() => '─')
            .join('')}`,
        );
        lines.push('');

        if (report.message) {
          lines.push(`  ${report.message}`);
          lines.push('');
          lines.push('');
        }

        if (report.sections && report.sections.length > 0) {
          for (const section of report.sections) {
            lines.push(`  ${chalk.bold(section.heading)}`);
            lines.push('');

            for (const item of section.items) {
              const prefix = formatSeverityPrefix(item.severity);
              lines.push(`    ${prefix}${item.message}`);
              if (item.ruleName) {
                lines.push(`       ${chalk.dim(item.ruleName)}`);
              }
            }

            lines.push('');
          }
        } else {
          lines.push(`  ${report.message}`);
          lines.push('');
        }
      }
    }

    lines.push('');
    lines.push(
      `Found ${chalk.red(`${analysis.statistics.severityCounts.error} errors`)}, ${chalk.yellow(`${analysis.statistics.severityCounts.warn} warnings`)} and ${chalk.blue(`${analysis.statistics.severityCounts.hint} hints`)}.`,
    );

    const coloredOutput = lines.join('\n');

    if (this.options.path) {
      const plainText = stripVTControlCharacters(coloredOutput);
      await mkdir(path.dirname(this.options.path), { recursive: true });
      await writeFile(this.options.path, plainText, 'utf-8');
    }

    return coloredOutput;
  }

  report(report: ThymianReport): void {
    this.reports.push(report);
  }
}
