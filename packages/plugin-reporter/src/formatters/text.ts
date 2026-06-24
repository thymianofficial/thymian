import * as path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import type { FindingRecord, Report, Severity } from '@thymian/core';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import {
  errorSymbol,
  hintSymbol,
  successSymbol,
  warnSymbol,
} from '../style.js';

function severityPrefix(severity: Severity): string {
  switch (severity) {
    case 'error':
      return chalk.red(`${errorSymbol} error`);
    case 'warn':
      return chalk.yellow(`${warnSymbol} warning`);
    case 'hint':
      return chalk.blue(`${hintSymbol} hint`);
    case 'info':
      return chalk.cyan(`${hintSymbol} info`);
  }
}

function renderFinding(finding: FindingRecord, indent = '    '): string[] {
  const lines = [
    `${indent}${severityPrefix(finding.severity)}: ${finding.title}`,
  ];
  if (finding.kind.startsWith('rule-') && 'ruleId' in finding) {
    lines.push(`${indent}  rule: ${finding.ruleId}`);
  }
  if (finding.message?.text && finding.message.text !== finding.title) {
    lines.push(`${indent}  ${finding.message.text}`);
  }
  if (finding.kind === 'assertion-failure') {
    const assertionFailure = finding as Extract<
      FindingRecord,
      { kind: 'assertion-failure' }
    >;
    lines.push(
      `${indent}  expected: ${JSON.stringify(assertionFailure.expected)}`,
    );
    lines.push(`${indent}  actual: ${JSON.stringify(assertionFailure.actual)}`);
  }
  if (finding.kind === 'test-case-skip') {
    const skipped = finding as Extract<
      FindingRecord,
      { kind: 'test-case-skip' }
    >;
    lines.push(`${indent}  reason: ${skipped.reason}`);
  }
  return lines;
}

function renderLocation(
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

export type TextFormatterOptions = {
  summaryOnly: boolean;
  path?: string;
};

export class TextFormatter implements Formatter<Partial<TextFormatterOptions>> {
  options!: TextFormatterOptions;

  private readonly reports: Report[] = [];

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
        await mkdir(path.dirname(this.options.path), { recursive: true });
        await writeFile(
          this.options.path,
          stripVTControlCharacters(message),
          'utf-8',
        );
      }

      return this.ensurePlainTextForNonTty(message);
    }

    const analysis = analyze(this.reports);
    const lines: string[] = [];

    if (!this.options.summaryOnly) {
      for (const report of this.reports) {
        lines.push(`Report ${report.reportId}`);
        lines.push('');
        for (const run of report.runs) {
          lines.push(`${run.tool.name} (${run.runType})`);
          for (const execution of run.executions ?? []) {
            lines.push(`  ${chalk.bold(renderLocation(execution.location))}`);
            for (const finding of execution.findings) {
              lines.push(...renderFinding(finding));
            }
            for (const child of execution.children ?? []) {
              lines.push(`    ${chalk.bold(renderLocation(child.location))}`);
              for (const finding of child.findings) {
                lines.push(...renderFinding(finding, '      '));
              }
            }
          }
          lines.push('');
        }
      }
    }

    const { error, warn, hint, info } = analysis.statistics.severityCounts;
    lines.push(
      `Summary: ${error} error(s), ${warn} warning(s), ${hint} hint(s), ${info} info finding(s) across ${analysis.statistics.numberOfRuns} run(s).`,
    );

    const output = lines.join('\n');

    if (this.options.path) {
      await mkdir(path.dirname(this.options.path), { recursive: true });
      await writeFile(
        this.options.path,
        stripVTControlCharacters(output),
        'utf-8',
      );
    }

    return this.ensurePlainTextForNonTty(output);
  }

  report(report: Report): void {
    this.reports.push(report);
  }

  private ensurePlainTextForNonTty(output: string): string {
    if (!process.stdout.isTTY) {
      return stripVTControlCharacters(output);
    }

    return output;
  }
}
