import * as path from 'node:path';

import type {
  Execution,
  Logger,
  Report,
  ReportHttpTransaction,
  Severity,
  ToolRun,
} from '@thymian/core';
import {
  buildRuleIndex,
  findingDetails,
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
  resolveExecutionSeverity,
  walkExecutions,
} from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import { analyze, type Formatter } from '../formatter.js';
import {
  colorSpan,
  errorSymbol,
  hintSymbol,
  infoSymbol,
  SEVERITY_COLORS,
  skippedSymbol,
  successSymbol,
  warnSymbol,
} from '../style.js';
import {
  createLocationResolver,
  type LocationResolver,
} from './resolve-location.js';

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function severityWord(severity: Severity): string {
  return severity === 'warn' ? 'warning' : severity;
}

function findingKindWord(kind: string): string {
  switch (kind) {
    case 'assertion-success':
      return 'passed';
    case 'assertion-failure':
    case 'rule-violation':
      return 'failed';
    case 'informational':
      return 'info';
    default:
      return kind;
  }
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

/** Deterministic `YYYY-MM-DD HH:mm` from the most recent report's ISO timestamp. */
function formatGeneratedDate(reports: Report[]): string {
  const mostRecent = reports.reduce(
    (latest, report) => (report.createdAt > latest ? report.createdAt : latest),
    '',
  );

  return `${mostRecent.slice(0, 10)} ${mostRecent.slice(11, 16)}`;
}

function buildRollupLine(
  reports: Report[],
  severityCounts: Record<Severity, number>,
  totalRuns: number,
): string {
  const { error, warn, hint, info } = severityCounts;
  const parts = [
    colorSpan(
      SEVERITY_COLORS.error,
      `${errorSymbol} ${error} ${pluralize(error, 'error')}`,
    ),
    colorSpan(
      SEVERITY_COLORS.warn,
      `${warnSymbol} ${warn} ${pluralize(warn, 'warning')}`,
    ),
    colorSpan(
      SEVERITY_COLORS.hint,
      `${hintSymbol} ${hint} ${pluralize(hint, 'hint')}`,
    ),
    colorSpan(SEVERITY_COLORS.info, `${infoSymbol} ${info} info`),
  ];

  return `${parts.join(' · ')} — across ${totalRuns} runs · generated ${formatGeneratedDate(reports)}`;
}

function countOutcomes(executions: Execution[] | undefined): {
  failed: number;
  skipped: number;
  passed: number;
} {
  let failed = 0;
  let skipped = 0;
  let passed = 0;

  for (const { execution } of walkExecutions(executions)) {
    if (execution.status.kind === 'failed') {
      failed += 1;
    } else if (execution.status.kind === 'skipped') {
      skipped += 1;
    } else {
      passed += 1;
    }
  }

  return { failed, skipped, passed };
}

function buildOverviewRow(run: ToolRun): string {
  const { failed, skipped, passed } = countOutcomes(run.executions);
  const outcome = `${errorSymbol} ${failed} failed · ${skippedSymbol} ${skipped} skipped · ${successSymbol} ${passed} passed`;
  const duration =
    run.duration !== undefined ? `${(run.duration / 1000).toFixed(2)}s` : '';

  return `| ${escapeCell(run.tool.name)} | ${run.runType} | ${outcome} | ${duration} |`;
}

/** Renders lint/analyze run bodies: location-grouped `Severity | Rule | Message` tables. */
function buildLintAnalyzeSection(
  run: ToolRun,
  resolveLocation: LocationResolver,
  logger: Logger,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${run.tool.name} · ${run.runType}`);
  lines.push('');

  const ruleIndex = buildRuleIndex(run.rules);
  const groups = new Map<string, string[]>();

  for (const { execution } of walkExecutions(run.executions)) {
    if (execution.kind !== 'lint' && execution.kind !== 'analyze') {
      continue;
    }

    const location = resolveLocation(
      execution.location,
      run.thymianFormatVersion,
    );
    const rows = groups.get(location) ?? [];
    if (!groups.has(location)) {
      groups.set(location, rows);
    }

    const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
    const ruleCell = execution.ruleId
      ? `\`${execution.ruleId}\``
      : 'unnamed check';

    if (execution.status.kind === 'failed') {
      const severity =
        resolveExecutionSeverity(execution, ruleIndex, logger) ?? 'error';
      const message =
        execution.status.reason ??
        rule?.summary?.text ??
        rule?.description?.text ??
        '';
      rows.push(
        `| ${severityWord(severity)} | ${ruleCell} | ${escapeCell(message)} |`,
      );
    } else if (execution.status.kind === 'skipped') {
      const message = execution.status.reason ?? rule?.summary?.text ?? '';
      rows.push(`| skipped | ${ruleCell} | ${escapeCell(message)} |`);
    }

    for (const finding of execution.findings) {
      if (finding.kind === 'informational') {
        rows.push(
          `| info | ${ruleCell} | ${escapeCell(finding.message?.text ?? finding.title)} |`,
        );
      }
    }
  }

  for (const [location, rows] of groups) {
    if (rows.length === 0) {
      continue;
    }

    lines.push(`### ${location}`);
    lines.push('');
    lines.push('| Severity | Rule | Message |');
    lines.push('| --- | --- | --- |');
    lines.push(...rows);
    lines.push('');
  }

  return lines;
}

function formatHttpTransaction(transaction: ReportHttpTransaction): string {
  const lines: string[] = [];
  const { request, response } = transaction;

  lines.push(`${request.method} ${request.path} HTTP/1.1`);
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (value !== undefined) {
      lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
  }
  lines.push('');
  if (request.body) {
    lines.push(request.body);
  }

  if (response) {
    lines.push('');
    const phrase = isValidHttpStatusCode(response.statusCode)
      ? httpStatusCodeToPhrase[response.statusCode].replace(/\b\w/g, (c) =>
          c.toUpperCase(),
        )
      : '';
    lines.push(`HTTP/1.1 ${response.statusCode}${phrase ? ` ${phrase}` : ''}`);
    for (const [name, value] of Object.entries(response.headers ?? {})) {
      if (value !== undefined) {
        lines.push(
          `${name}: ${Array.isArray(value) ? value.join(', ') : value}`,
        );
      }
    }
    lines.push('');
    if (response.body) {
      lines.push(response.body);
    }
  }

  return lines.join('\n').trimEnd();
}

/** Renders test run bodies: per-test-case `<details>` narrative with per-finding step rows. */
function buildTestSection(
  run: ToolRun,
  resolveLocation: LocationResolver,
  logger: Logger,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${run.tool.name} · test`);
  lines.push('');

  const ruleIndex = buildRuleIndex(run.rules);

  for (const { execution } of walkExecutions(run.executions)) {
    if (execution.kind !== 'test' || execution.status.kind === 'passed') {
      continue;
    }

    const statusGlyph =
      execution.status.kind === 'failed' ? errorSymbol : skippedSymbol;
    lines.push(
      `### ${execution.name} · _${statusGlyph} ${execution.status.kind}_`,
    );
    lines.push('');

    const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
    const severity = resolveExecutionSeverity(execution, ruleIndex, logger);
    const severityPrefix = severity ? `${severityWord(severity)} · ` : '';
    const ruleCell = `<code>${execution.ruleId ?? 'unnamed check'}</code>`;
    const message =
      execution.status.kind === 'failed'
        ? (execution.status.reason ??
          rule?.summary?.text ??
          rule?.description?.text ??
          '')
        : (execution.status.reason ?? rule?.summary?.text ?? '');

    lines.push(
      `<details><summary>${severityPrefix}${ruleCell} · ${message}</summary>`,
    );
    lines.push('');

    execution.steps.forEach((step, index) => {
      const stepLocation = resolveLocation(
        step.location,
        run.thymianFormatVersion,
      );
      lines.push(`**Step ${index + 1}** · ${stepLocation}`);
      lines.push('');

      if (step.findings.length > 0) {
        lines.push('| Kind | Title | Message |');
        lines.push('| --- | --- | --- |');
        for (const finding of step.findings) {
          const kind = findingKindWord(finding.kind);
          let message = finding.message?.text ?? '';

          if (finding.kind === 'assertion-failure') {
            const detail = findingDetails(finding);
            const expected = detail.find((d) => d.label === 'expected')?.value;
            const actual = detail.find((d) => d.label === 'actual')?.value;
            const suffix = `— expected: ${expected}, actual: ${actual}`;
            message = message ? `${message} ${suffix}` : suffix;
          }

          lines.push(
            `| ${kind} | ${escapeCell(finding.title)} | ${escapeCell(message)} |`,
          );
        }
        lines.push('');
      }

      if (step.httpTransactions?.length) {
        lines.push('<details><summary>HTTP transaction</summary>');
        lines.push('');
        for (const transaction of step.httpTransactions) {
          lines.push('```http');
          lines.push(formatHttpTransaction(transaction));
          lines.push('```');
          lines.push('');
        }
        lines.push('</details>');
        lines.push('');
      }
    });

    lines.push('</details>');
    lines.push('');
  }

  return lines;
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
    const lines: string[] = [];

    lines.push('# Thymian Report');
    lines.push('');
    lines.push(
      buildRollupLine(
        this.reports,
        analysis.statistics.severityCounts,
        analysis.statistics.numberOfRuns,
      ),
    );
    lines.push('');
    lines.push(
      `<sub>${errorSymbol} error · ${warnSymbol} warning · ${hintSymbol} hint · ${infoSymbol} info · ${successSymbol} passed · ${skippedSymbol} skipped</sub>`,
    );
    lines.push('');
    lines.push('| Run | Type | Outcome | Duration |');
    lines.push('| --- | --- | --- | --- |');
    for (const report of this.reports) {
      for (const run of report.runs) {
        lines.push(buildOverviewRow(run));
      }
    }
    lines.push('');

    for (const report of this.reports) {
      const resolveLocation = createLocationResolver(report);
      for (const run of report.runs) {
        lines.push(
          ...(run.runType === 'test'
            ? buildTestSection(run, resolveLocation, this.logger)
            : buildLintAnalyzeSection(run, resolveLocation, this.logger)),
        );
      }
    }

    const output = lines.join('\n');

    await mkdir(path.dirname(this.options.path), { recursive: true });
    await writeFile(this.options.path, output, 'utf-8');
    this.logger.debug(`Wrote Markdown report to ${this.options.path}.`);

    return output;
  }
}
