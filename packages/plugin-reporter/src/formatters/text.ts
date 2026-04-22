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

/**
 * Visible column width of a severity prefix in a monospace terminal.
 *
 * Unicode symbols (✖ U+2716, ⚠ U+26A0, ℹ U+2139) each occupy one terminal
 * column in standard monospace fonts. We use hardcoded values instead of
 * `.length` on template strings because JavaScript's string length counts
 * UTF-16 code units, which may differ from visual column width for characters
 * outside the BMP. For these specific BMP symbols the values happen to match.
 *
 * Widths:  "✖ error: " = 9,  "⚠ warning: " = 11,  "ℹ hint: " = 8
 */
function severityPrefixWidth(severity: ThymianReportSeverity): number {
  switch (severity) {
    case 'error':
      return 9; // "✖ error: "
    case 'warn':
      return 11; // "⚠ warning: "
    case 'hint':
      return 8; // "ℹ hint: "
    default:
      return 0;
  }
}

/**
 * Regex matching severity-grouped section headings produced by the core report
 * sorter in severity mode, e.g. "Errors (3)", "Warnings (1)", "Hints (2)", "Info (1)".
 */
const SEVERITY_HEADING_RE = /^(Errors|Warnings|Hints|Info)\s*\(\d+\)$/;

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

  private readonly reportsMap: Map<string, ThymianReport[]> = new Map();

  init(options: Partial<TextFormatterOptions>): void {
    this.options = {
      summaryOnly: false,
      ...options,
    };
  }

  async flush(): Promise<string | undefined> {
    if (this.reportsMap.size === 0) {
      const message = `${chalk.green(successSymbol)} No problems found`;

      if (this.options.path) {
        const plainText = stripVTControlCharacters(message);
        await mkdir(path.dirname(this.options.path), { recursive: true });
        await writeFile(this.options.path, plainText, 'utf-8');
      }

      return this.ensurePlainTextForNonTty(message);
    }

    const analysis = analyze(this.reportsMap);
    const lines: string[] = [];

    if (!this.options.summaryOnly) {
      for (const [source, reports] of this.reportsMap.entries()) {
        lines.push(
          `${source} ${Array.from({
            length: Math.max(1, 80 - source.length),
          })
            .map(() => '─')
            .join('')}`,
        );

        lines.push('');

        lines.push(
          reports
            .map((report) => report.message)
            .filter(Boolean)
            .join(' '),
        );

        lines.push('');

        for (const report of reports) {
          if (report.sections && report.sections.length > 0) {
            for (const section of report.sections) {
              const isSeverityGrouped = SEVERITY_HEADING_RE.test(
                section.heading,
              );

              lines.push(`  ${chalk.bold(section.heading)}`);
              lines.push('');

              for (const item of section.items) {
                // When grouped by severity the heading already conveys the
                // severity level → skip the per-item severity prefix to
                // avoid redundant "Errors (3)  ✖ error: …" lines.
                const prefix = isSeverityGrouped
                  ? ''
                  : formatSeverityPrefix(item.severity);

                // 4 spaces base indentation + prefix + message
                lines.push(`    ${prefix}${item.message}`);

                // When grouped by rule the heading already shows the rule
                // name → skip the per-item rule name to avoid duplication.
                const ruleRedundant = item.ruleName === section.heading;
                if (item.ruleName && !ruleRedundant) {
                  // Align rule name under message text:
                  // 4 spaces base indent + prefix visible width
                  const indent = isSeverityGrouped
                    ? 4
                    : 4 + severityPrefixWidth(item.severity);
                  lines.push(
                    `${' '.repeat(indent)}${chalk.dim(item.ruleName)}`,
                  );
                }
              }

              lines.push('');
            }
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

    return this.ensurePlainTextForNonTty(coloredOutput);
  }

  report(report: ThymianReport): void {
    if (!this.reportsMap.has(report.source)) {
      this.reportsMap.set(report.source, []);
    }

    this.reportsMap.get(report.source)?.push(report);
  }

  /**
   * Ensure output is plain text (no ANSI escape sequences) when stdout is not a TTY.
   *
   * Chalk auto-detects TTY and sets `chalk.level = 0` for non-TTY, which prevents
   * new styling. However, if chalk level was forced or if any ANSI codes slip through
   * from other sources, this safety net strips them for non-TTY output.
   */
  private ensurePlainTextForNonTty(output: string): string {
    if (!process.stdout.isTTY) {
      return stripVTControlCharacters(output);
    }
    return output;
  }
}
