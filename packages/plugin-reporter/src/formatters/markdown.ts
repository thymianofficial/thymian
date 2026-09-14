import * as path from 'node:path';

import type {
  Execution,
  FindingRecord,
  Logger,
  Report,
  ReportHttpTransaction,
  Severity,
  SortReportsBy,
  TestCaseExecution,
  ToolRun,
} from '@thymian/core';
import {
  buildRuleIndex,
  compareSeverityGroupKeys,
  findingDetails,
  httpStatusCodeToPhrase,
  isValidHttpStatusCode,
  pluralizeSeverity,
  resolveExecutionSeverity,
  resolveGroupSeverity,
  SEVERITY_SYMBOLS,
  severityGroupKey,
  UNNAMED_CHECK_LABEL,
  walkExecutions,
} from '@thymian/core';
import { mkdir, writeFile } from 'fs/promises';

import {
  analyze,
  type FileFormatterOptions,
  type Formatter,
  type FormatterRuntimeOptions,
} from '../formatter.js';
import { resolveReportPath } from '../report-file-name.js';
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

/**
 * Escapes text interpolated into raw HTML — both element content
 * (e.g. inside `<details><summary>`) and double/single-quoted attribute
 * values (e.g. `href="…"`). Quotes are escaped so a value cannot break out
 * of its attribute; escaping them in element content is harmless.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Renders the "Rule" cell: the rule id as inline code, linked to its `helpUri`
 * when present. Uses an HTML anchor (not a markdown `[text](url)` link) so a
 * `helpUri` containing `)`, whitespace, etc. cannot break out of the link.
 * Callers placing this inside a `|`-delimited table cell must still run the
 * result through `escapeCell` to neutralise any `|`.
 */
function renderRuleCell(
  ruleId: string | undefined,
  helpUri: string | undefined,
): string {
  const label = escapeHtml(ruleId ?? 'unnamed check');
  return helpUri
    ? `<a href="${escapeHtml(helpUri)}"><code>${label}</code></a>`
    : `<code>${label}</code>`;
}

function severityWord(severity: Severity): string {
  return severity === 'warn' ? 'warning' : severity;
}

/**
 * The heading a failed/skipped execution is grouped under for a given
 * `--sort-reports-by` mode. `endpoint` keeps the historical key (location for
 * lint/analyze, test-case name for test); `rule`/`severity` regroup uniformly.
 */
function executionGroupKey(
  execution: Execution,
  sortReportsBy: SortReportsBy,
  ruleIndex: ReturnType<typeof buildRuleIndex>,
  resolveLocation: LocationResolver,
  run: ToolRun,
  logger: Logger,
): string {
  if (sortReportsBy === 'rule') {
    return execution.ruleId ?? UNNAMED_CHECK_LABEL;
  }
  if (sortReportsBy === 'severity') {
    return severityGroupKey(execution, ruleIndex, logger);
  }
  return execution.kind === 'test'
    ? execution.name
    : resolveLocation(execution.location, run.thymianFormatVersion);
}

/**
 * Orders group headings for a mode: `endpoint` keeps insertion (walk) order;
 * `rule` sorts alphabetically; `severity` follows the shared core comparator
 * (error→warn→hint→info, non-severity keys last).
 */
function orderGroupKeys(
  keys: string[],
  sortReportsBy: SortReportsBy,
): string[] {
  if (sortReportsBy === 'severity') {
    return [...keys].sort(compareSeverityGroupKeys);
  }
  if (sortReportsBy === 'rule') {
    return [...keys].sort((a, b) => a.localeCompare(b));
  }
  return keys;
}

/**
 * Group-heading text for a mode, mirroring the CLI report: `rule` shows the
 * rule's severity + id; `severity` shows the symbol + pluralized severity;
 * `endpoint` keeps the raw key (resolved location / test-case name).
 * `fallbackSeverity` (the group's first resolved severity) matches the CLI when
 * the rule id has no descriptor.
 */
function groupHeadingText(
  key: string,
  sortReportsBy: SortReportsBy,
  ruleIndex: ReturnType<typeof buildRuleIndex>,
  fallbackSeverity?: Severity,
): string {
  if (sortReportsBy === 'rule') {
    const severity =
      ruleIndex.get(key)?.severity ?? fallbackSeverity ?? 'error';
    // The rule id is user-authored; escape it like table cells so a `<…>` /
    // metacharacter id cannot inject raw markup into the heading.
    return `${SEVERITY_SYMBOLS[severity]} ${severity}: ${escapeHtml(key)}`;
  }
  if (sortReportsBy === 'severity') {
    const symbol =
      key === 'skipped'
        ? SEVERITY_SYMBOLS.skipped
        : SEVERITY_SYMBOLS[key as Severity];
    return `${symbol} ${pluralizeSeverity(key).toUpperCase()}`;
  }
  return key;
}

/**
 * Column layout for a lint/analyze table. `rule`/`severity` swap in a Location
 * column — the identity the group heading no longer carries — and drop the
 * column now redundant with the heading (Rule / Severity respectively).
 */
function lintAnalyzeTableHeader(sortReportsBy: SortReportsBy): string[] {
  // Drop the column the group heading already carries: `rule` drops Severity
  // and Rule (both implied by the rule heading); `severity` drops Severity.
  const columns =
    sortReportsBy === 'rule'
      ? ['Location', 'Message']
      : sortReportsBy === 'severity'
        ? ['Rule', 'Location', 'Message']
        : ['Severity', 'Rule', 'Message'];
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
}

/** Builds one lint/analyze table row with the column layout for the mode. */
function renderLintAnalyzeRow(
  sortReportsBy: SortReportsBy,
  cells: {
    statusLabel: string;
    ruleCell: string;
    locationCell: string;
    message: string;
  },
): string {
  const { statusLabel, ruleCell, locationCell, message } = cells;
  if (sortReportsBy === 'rule') {
    return `| ${locationCell} | ${message} |`;
  }
  if (sortReportsBy === 'severity') {
    return `| ${ruleCell} | ${locationCell} | ${message} |`;
  }
  return `| ${statusLabel} | ${ruleCell} | ${message} |`;
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

/**
 * Build the `— expected: …, actual: …` suffix for an `assertion-failure`
 * finding from its {@link findingDetails}. Omits either half when the
 * corresponding detail is absent, and returns `''` when neither is present.
 */
function assertionFailureSuffix(finding: FindingRecord): string {
  const detail = findingDetails(finding);
  const expected = detail.find((d) => d.label === 'expected')?.value;
  const actual = detail.find((d) => d.label === 'actual')?.value;

  const parts: string[] = [];
  if (expected !== undefined) {
    parts.push(`expected: ${expected}`);
  }
  if (actual !== undefined) {
    parts.push(`actual: ${actual}`);
  }

  return parts.length > 0 ? `— ${parts.join(', ')}` : '';
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

  for (const execution of walkExecutions(executions)) {
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

/**
 * Renders lint/analyze run bodies as grouped tables. The column layout and
 * group heading vary by `--sort-reports-by`; `endpoint` (default) keeps the
 * historical location-grouped `Severity | Rule | Message` layout.
 */
function buildLintAnalyzeSection(
  run: ToolRun,
  resolveLocation: LocationResolver,
  logger: Logger,
  sortReportsBy: SortReportsBy,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${run.tool.name} · ${run.runType}`);
  lines.push('');

  const ruleIndex = buildRuleIndex(run.rules);
  const groups = new Map<string, { rows: string[]; executions: Execution[] }>();

  for (const execution of walkExecutions(run.executions)) {
    if (execution.kind !== 'lint' && execution.kind !== 'analyze') {
      continue;
    }

    // Under `rule`/`severity` grouping a passed execution has no meaningful
    // group key (its severity is undefined → would fall into the `error`
    // bucket) and is not a violation, so exclude it and its informational
    // findings — matching the CLI grouped renderer, which skips passed
    // executions. `endpoint` groups by location and keeps them, so its output
    // is unchanged.
    if (sortReportsBy !== 'endpoint' && execution.status.kind === 'passed') {
      continue;
    }

    const groupKey = executionGroupKey(
      execution,
      sortReportsBy,
      ruleIndex,
      resolveLocation,
      run,
      logger,
    );
    let group = groups.get(groupKey);
    if (!group) {
      group = { rows: [], executions: [] };
      groups.set(groupKey, group);
    }
    group.executions.push(execution);

    const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
    // HTML anchor (via renderRuleCell), then escapeCell so a `|` in the id/uri
    // can't break the surrounding markdown table row.
    const ruleCell = escapeCell(
      renderRuleCell(execution.ruleId, rule?.helpUri),
    );
    // Location is the group heading under `endpoint`, but a table column under
    // `rule`/`severity` so it is not lost.
    const locationCell = escapeCell(
      resolveLocation(execution.location, run.thymianFormatVersion),
    );

    const row = (statusLabel: string, message: string): string =>
      renderLintAnalyzeRow(sortReportsBy, {
        statusLabel,
        ruleCell,
        locationCell,
        message: escapeCell(message),
      });

    if (execution.status.kind === 'failed') {
      const severity =
        resolveExecutionSeverity(execution, ruleIndex, logger) ?? 'error';
      const message =
        execution.status.reason ??
        rule?.summary?.text ??
        rule?.description?.text ??
        '';
      group.rows.push(row(severityWord(severity), message));
    } else if (execution.status.kind === 'skipped') {
      const message = execution.status.reason ?? rule?.summary?.text ?? '';
      group.rows.push(row('skipped', message));
    }

    for (const finding of execution.findings) {
      if (finding.kind === 'informational') {
        group.rows.push(row('info', finding.message?.text ?? finding.title));
      } else if (finding.kind === 'assertion-failure') {
        const suffix = assertionFailureSuffix(finding);
        const base = finding.message?.text ?? finding.title;
        group.rows.push(row('failed', suffix ? `${base} ${suffix}` : base));
      }
    }
  }

  for (const groupKey of orderGroupKeys([...groups.keys()], sortReportsBy)) {
    const group = groups.get(groupKey);
    if (!group || group.rows.length === 0) {
      continue;
    }

    lines.push(
      `### ${groupHeadingText(
        groupKey,
        sortReportsBy,
        ruleIndex,
        resolveGroupSeverity(group.executions, ruleIndex, logger),
      )}`,
    );
    lines.push('');
    lines.push(...lintAnalyzeTableHeader(sortReportsBy));
    lines.push(...group.rows);
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

/** Renders one failed/skipped test case under the given heading prefix (`###`/`####`). */
function renderTestCase(
  execution: TestCaseExecution,
  headingPrefix: string,
  resolveLocation: LocationResolver,
  run: ToolRun,
  ruleIndex: ReturnType<typeof buildRuleIndex>,
  logger: Logger,
  sortReportsBy: SortReportsBy,
): string[] {
  const lines: string[] = [];

  const statusGlyph =
    execution.status.kind === 'failed' ? errorSymbol : skippedSymbol;
  lines.push(
    `${headingPrefix} ${execution.name} · _${statusGlyph} ${execution.status.kind}_`,
  );
  lines.push('');

  const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
  const severity = resolveExecutionSeverity(execution, ruleIndex, logger);
  const ruleCell = renderRuleCell(execution.ruleId, rule?.helpUri);
  const message =
    execution.status.kind === 'failed'
      ? (execution.status.reason ??
        rule?.summary?.text ??
        rule?.description?.text ??
        '')
      : execution.status.kind === 'skipped'
        ? (execution.status.reason ?? rule?.summary?.text ?? '')
        : '';

  // The summary omits whatever the group heading already carries: the severity
  // under `severity` grouping, the rule under `rule` grouping.
  const summaryParts: string[] = [];
  if (sortReportsBy !== 'severity' && severity) {
    summaryParts.push(severityWord(severity));
  }
  if (sortReportsBy !== 'rule') {
    summaryParts.push(ruleCell);
  }
  summaryParts.push(escapeHtml(message));

  lines.push(`<details><summary>${summaryParts.join(' · ')}</summary>`);
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
          const suffix = assertionFailureSuffix(finding);
          message = suffix
            ? message
              ? `${message} ${suffix}`
              : suffix
            : message;
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

  return lines;
}

/** Renders test run bodies: per-test-case `<details>` narrative with per-finding step rows. */
function buildTestSection(
  run: ToolRun,
  resolveLocation: LocationResolver,
  logger: Logger,
  sortReportsBy: SortReportsBy,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${run.tool.name} · test`);
  lines.push('');

  const ruleIndex = buildRuleIndex(run.rules);

  const cases = [...walkExecutions(run.executions)].filter(
    (execution): execution is TestCaseExecution =>
      execution.kind === 'test' && execution.status.kind !== 'passed',
  );

  // `endpoint` keeps the flat, per-case `###` layout unchanged.
  if (sortReportsBy === 'endpoint') {
    for (const execution of cases) {
      lines.push(
        ...renderTestCase(
          execution,
          '###',
          resolveLocation,
          run,
          ruleIndex,
          logger,
          sortReportsBy,
        ),
      );
    }
    return lines;
  }

  // `rule`/`severity` add a `###` group heading; each case drops to `####` so
  // its name survives under the (rule id / severity) group.
  const groups = new Map<string, TestCaseExecution[]>();
  for (const execution of cases) {
    const key = executionGroupKey(
      execution,
      sortReportsBy,
      ruleIndex,
      resolveLocation,
      run,
      logger,
    );
    const groupCases = groups.get(key) ?? [];
    if (!groups.has(key)) {
      groups.set(key, groupCases);
    }
    groupCases.push(execution);
  }

  for (const key of orderGroupKeys([...groups.keys()], sortReportsBy)) {
    const groupCases = groups.get(key) ?? [];
    if (groupCases.length === 0) {
      continue;
    }
    lines.push(
      `### ${groupHeadingText(
        key,
        sortReportsBy,
        ruleIndex,
        resolveGroupSeverity(groupCases, ruleIndex, logger),
      )}`,
    );
    lines.push('');
    for (const execution of groupCases) {
      lines.push(
        ...renderTestCase(
          execution,
          '####',
          resolveLocation,
          run,
          ruleIndex,
          logger,
          sortReportsBy,
        ),
      );
    }
  }

  return lines;
}

export type MarkdownFormatterOptions = FileFormatterOptions;

/**
 * Human-readable formatter. Each report is rendered and written to its own run
 * directory as soon as it arrives, so a session that emits several reports
 * produces several documents rather than one aggregate pinned to the first
 * report.
 */
export class MarkdownFormatter implements Formatter<MarkdownFormatterOptions> {
  options!: MarkdownFormatterOptions & FormatterRuntimeOptions;

  /**
   * Grouping strategy injected by the reporter plugin from `--sort-reports-by`.
   * Kept off {@link MarkdownFormatterOptions} so the user-facing formatter
   * config schema stays empty; defaults to `endpoint`.
   */
  private sortReportsBy: SortReportsBy = 'endpoint';

  /**
   * Document of the most recently written report, handed back by {@link flush}
   * so a caller that drives a single report still gets the rendered output.
   *
   * No production consumer: the reporter plugin discards `flush()`'s return
   * value. It exists for the {@link Formatter} contract and for callers — tests
   * today — that drive one report and assert on the rendering. Bounded to one
   * document on purpose; retaining every report is what this formatter used to
   * do to build a session-level aggregate.
   */
  private lastOutput: string | undefined;

  /**
   * Tail of the write chain. `core.report` is emitted fire-and-forget — the
   * emitter never awaits its subscribers — so without this a `flush()` during
   * `core.close` could return before a report reached disk, and `serve` calls
   * `process.exit()` right after. Serializing on one chain also keeps two
   * overlapping reports from interleaving.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly logger: Logger) {}

  init(
    options: MarkdownFormatterOptions &
      FormatterRuntimeOptions & { sortReportsBy?: SortReportsBy },
  ): void {
    this.options = options;
    this.sortReportsBy = options.sortReportsBy ?? 'endpoint';
  }

  async report(report: Report): Promise<void> {
    const task = this.queue.then(async () => this.write(report));

    // Keep the chain alive even if this write rejects, so one failure cannot
    // poison every later report.
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  /**
   * Awaits every write started so far and hands back the last document.
   *
   * Never throws: it runs inside the `core.close` action handler, and a
   * destination that could not be written must not take the shutdown with it.
   */
  async flush(): Promise<string | undefined> {
    await this.queue;

    return this.lastOutput;
  }

  /** Render and persist one report. Never throws. */
  private async write(report: Report): Promise<void> {
    const outputPath = resolveReportPath(
      this.options.cwd ?? process.cwd(),
      this.options.reportsDir,
      report,
      'md',
    );

    try {
      // Rendering is inside the guard too: a malformed report (an execution
      // shape `analyze` chokes on, a throwing accessor) must degrade exactly
      // like an unwritable destination rather than reject out of `report()`.
      const output = this.render(report);

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, output, 'utf-8');
      this.logger.info(`Wrote Markdown report to ${outputPath}.`);
      this.lastOutput = output;
    } catch (err) {
      // A destination we cannot create or write leaves this formatter inert for
      // that report: throwing here would abort the `core.report` handler and
      // take every other formatter — and the run — down with it.
      this.logger.error(
        `Failed to write Markdown report to ${outputPath}: ${
          err instanceof Error ? err.message : String(err)
        }. No Markdown report will be written for this report.`,
      );
    }
  }

  /** Render one report into the full Markdown document. */
  private render(report: Report): string {
    const reports = [report];
    const analysis = analyze(reports, this.logger);
    const lines: string[] = [];

    lines.push('# Thymian Report');
    lines.push('');
    lines.push(
      buildRollupLine(
        reports,
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
    for (const run of report.runs) {
      lines.push(buildOverviewRow(run));
    }
    lines.push('');

    const sortReportsBy = this.sortReportsBy;
    const resolveLocation = createLocationResolver(report);
    for (const run of report.runs) {
      lines.push(
        ...(run.runType === 'test'
          ? buildTestSection(run, resolveLocation, this.logger, sortReportsBy)
          : buildLintAnalyzeSection(
              run,
              resolveLocation,
              this.logger,
              sortReportsBy,
            )),
      );
    }

    return lines.join('\n');
  }
}
