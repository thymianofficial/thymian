import * as path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import type {
  Execution,
  ExecutionStatus,
  FindingRecord,
  Location,
  Report,
  RuleDescriptor,
  Severity,
} from '@thymian/core';
import {
  buildRuleIndex,
  findingDetails,
  resolveExecutionSeverity,
  walkExecutions,
} from '@thymian/core';
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

function renderStatus(
  status: ExecutionStatus,
  severity: Severity | undefined,
): string {
  switch (status.kind) {
    case 'passed': {
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds}ms)`
          : '';
      return `${chalk.green(successSymbol)} passed${duration}`;
    }
    case 'failed': {
      const prefix = severityPrefix(severity ?? 'error');
      const reason = status.reason ? `: ${status.reason}` : '';
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds}ms)`
          : '';
      return `${prefix} failed${reason}${duration}`;
    }
    case 'skipped':
      return `skipped${status.reason ? `: ${status.reason}` : ''}`;
  }
}

function renderFinding(finding: FindingRecord, indent: string): string[] {
  const lines = [`${indent}[${finding.kind}] ${finding.title}`];

  if (finding.message?.text && finding.message.text !== finding.title) {
    lines.push(`${indent}  ${finding.message.text}`);
  }

  for (const detail of findingDetails(finding)) {
    lines.push(`${indent}  ${detail.label}: ${detail.value}`);
  }

  return lines;
}

function renderLocation(location: Location): string {
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

function renderExecution(
  execution: Execution,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
): string[] {
  const label =
    execution.kind === 'test'
      ? execution.name
      : renderLocation(execution.location);
  const lines = [
    `  ${chalk.bold(label)}${execution.ruleId ? ` (${execution.ruleId})` : ''}`,
  ];

  const severity = resolveExecutionSeverity(execution, ruleIndex);
  lines.push(`    ${renderStatus(execution.status, severity)}`);

  if (execution.kind === 'test') {
    for (const step of execution.steps) {
      if (step.findings.length === 0) {
        continue;
      }
      lines.push(`    ${step.name} — ${renderLocation(step.location)}`);
      for (const finding of step.findings) {
        lines.push(...renderFinding(finding, '      '));
      }
    }
  } else {
    for (const finding of execution.findings) {
      lines.push(...renderFinding(finding, '    '));
    }
  }

  return lines;
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
          const ruleIndex = buildRuleIndex(run.rules);
          for (const { execution } of walkExecutions(run.executions)) {
            lines.push(...renderExecution(execution, ruleIndex));
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
