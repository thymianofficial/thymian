import * as path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import type { ThymianReport, ThymianReportSeverity } from '@thymian/core';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import {
  errorSymbol,
  hintSymbol,
  successSymbol,
  warnSymbol,
} from '../style.js';

export function formatSeverityPrefix(severity: ThymianReportSeverity): string {
  if (severity === 'hint') {
    return `${chalk.blue(`${hintSymbol} ${severity}`)}: `;
  }
  if (severity === 'warn') {
    return `${chalk.yellow(`${warnSymbol} warning`)}: `;
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
      const message = `${chalk.green(successSymbol)} No problems found`;

      if (this.options.path) {
        const plainText = stripVTControlCharacters(message);
        await mkdir(path.dirname(this.options.path), { recursive: true });
        await writeFile(this.options.path, plainText, 'utf-8');
      }

      return message;
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
        }
      }
    }

    lines.push('');
    const { error, warn, hint } = analysis.statistics.severityCounts;
    lines.push(
      `Found ${chalk.red(`${error} ${error === 1 ? 'error' : 'errors'}`)}, ${chalk.yellow(`${warn} ${warn === 1 ? 'warning' : 'warnings'}`)} and ${chalk.blue(`${hint} ${hint === 1 ? 'hint' : 'hints'}`)}.`,
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
