import {
  buildRuleIndex,
  createLocationResolver,
  errorSymbol,
  type Execution,
  type ExecutionStatus,
  findingDetails,
  type FindingRecord,
  hintSymbol,
  infoSymbol,
  type LocationResolver,
  type Report,
  type ReportHttpTransaction,
  resolveExecutionSeverity,
  type RuleDescriptor,
  type Severity,
  SEVERITY_COLORS,
  skippedSymbol,
  successSymbol,
  type ThymianFormat,
  walkExecutions,
  warnSymbol,
} from '@thymian/core';

const SUPPORTED_FINDING_KINDS = new Set<FindingRecord['kind']>([
  'rule-violation',
  'assertion-success',
  'assertion-failure',
  'informational',
]);

function colorizeText(text: string, severity: Severity): string {
  if (!process.stdout.isTTY) {
    return text;
  }

  const hex = SEVERITY_COLORS[severity].replace('#', '');
  const rgb = hex.match(/[0-9a-f]{2}/gi)?.map((part) => parseInt(part, 16));

  if (rgb?.length !== 3) {
    return text;
  }

  return `${String.fromCharCode(27)}[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}${String.fromCharCode(27)}[0m`;
}

function symbolForSeverity(severity: Severity): string {
  switch (severity) {
    case 'error':
      return errorSymbol;
    case 'warn':
      return warnSymbol;
    case 'hint':
      return hintSymbol;
    case 'info':
      return infoSymbol;
  }
}

function ruleLabel(
  ruleId: string | undefined,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
): string {
  if (ruleId === undefined) {
    return '';
  }

  const descriptor = ruleIndex.get(ruleId);
  if (!descriptor?.name || descriptor.name === ruleId) {
    return ruleId;
  }

  return `${descriptor.name} (${ruleId})`;
}

function ruleCell(
  ruleId: string | undefined,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
): string {
  return ruleLabel(ruleId, ruleIndex) || 'unnamed check';
}

function severityWord(severity: Severity): string {
  return severity === 'warn' ? 'warning' : severity;
}

function renderDiagnosticBlock(opts: {
  label: string;
  message: string;
  rule: string;
  severity?: Severity;
  symbol: string;
}): string[] {
  const head = `    ${opts.symbol} ${opts.label} ${opts.rule}`;
  const lines = [opts.severity ? colorizeText(head, opts.severity) : head];

  if (opts.message) {
    lines.push(`      ${opts.message}`);
  }

  return lines;
}

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

  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}

function renderFinding(finding: FindingRecord, indent = '    '): string[] {
  if (!SUPPORTED_FINDING_KINDS.has(finding.kind)) {
    return [];
  }

  const lines = [`${indent}${finding.title}`];

  if (finding.message?.text && finding.message.text !== finding.title) {
    lines.push(`${indent}  ${finding.message.text}`);
  }

  for (const detail of findingDetails(finding)) {
    lines.push(`${indent}  ${detail.label}: ${detail.value}`);
  }

  return lines;
}

function formatTransactionRequest(transaction: ReportHttpTransaction): string {
  const { request } = transaction;
  const method = request.method.toUpperCase();

  try {
    return `${method} ${new URL(request.path, request.origin).toString()}`;
  } catch {
    return `${method} ${request.origin}${request.path}`;
  }
}

function renderHttpTransaction(
  transaction: ReportHttpTransaction,
  indent = '      ',
): string {
  const response = transaction.response
    ? ` -> ${transaction.response.statusCode}`
    : '';
  return `${indent}HTTP: ${formatTransactionRequest(transaction)}${response}`;
}

function renderStatus(
  status: ExecutionStatus,
  severity: Severity | undefined,
): string {
  switch (status.kind) {
    case 'passed': {
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds.toFixed(2)}ms)`
          : '';
      return `${successSymbol} passed${duration}`;
    }
    case 'failed': {
      const resolved = severity ?? 'error';
      const reason = status.reason ? `: ${status.reason}` : '';
      const duration =
        status.durationMilliseconds !== undefined
          ? ` (${status.durationMilliseconds.toFixed(2)}ms)`
          : '';
      return colorizeText(
        `${symbolForSeverity(resolved)} failed${reason}${duration}`,
        resolved,
      );
    }
    case 'skipped':
      return `${skippedSymbol} skipped${status.reason ? `: ${status.reason}` : ''}`;
  }
}

function renderTestExecution(
  execution: Execution,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  resolveLocation: LocationResolver,
  runVersion: string | undefined,
): string[] {
  if (execution.kind !== 'test') {
    return [];
  }

  const label = execution.name;
  const displayRule = ruleLabel(execution.ruleId, ruleIndex);
  const lines = [`  ${label}${displayRule ? ` ${displayRule}` : ''}`];

  const severity = resolveExecutionSeverity(execution, ruleIndex);
  lines.push(`    ${renderStatus(execution.status, severity)}`);

  for (const step of execution.steps) {
    const findingLines = step.findings.flatMap((finding) =>
      renderFinding(finding, '      '),
    );
    const transactionLines = (step.httpTransactions ?? []).map((transaction) =>
      renderHttpTransaction(transaction),
    );

    if (findingLines.length === 0 && transactionLines.length === 0) {
      continue;
    }
    lines.push(
      `    ${step.name} ${resolveLocation(step.location, runVersion)}`,
    );
    lines.push(...findingLines, ...transactionLines);
  }

  return lines;
}

function renderLintAnalyzeRow(
  execution: Exclude<Execution, { kind: 'test' }>,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
): string[] {
  const rows: string[] = [];
  const rule = execution.ruleId ? ruleIndex.get(execution.ruleId) : undefined;
  const ruleText = ruleCell(execution.ruleId, ruleIndex);

  if (execution.status.kind === 'failed') {
    const severity = resolveExecutionSeverity(execution, ruleIndex) ?? 'error';
    const message =
      execution.status.reason ??
      rule?.summary?.text ??
      rule?.description?.text ??
      '';
    rows.push(
      ...renderDiagnosticBlock({
        label: severityWord(severity),
        message,
        rule: ruleText,
        severity,
        symbol: symbolForSeverity(severity),
      }),
    );
  } else if (execution.status.kind === 'skipped') {
    const message = execution.status.reason ?? rule?.summary?.text ?? '';
    rows.push(
      ...renderDiagnosticBlock({
        label: 'skipped',
        message,
        rule: ruleText,
        symbol: skippedSymbol,
      }),
    );
  }

  for (const finding of execution.findings) {
    if (finding.kind === 'informational') {
      rows.push(
        ...renderDiagnosticBlock({
          label: 'info',
          message: finding.message?.text ?? finding.title,
          rule: ruleText,
          severity: 'info',
          symbol: infoSymbol,
        }),
      );
    } else if (finding.kind === 'assertion-failure') {
      const base = finding.message?.text ?? finding.title;
      rows.push(
        ...renderDiagnosticBlock({
          label: 'failed',
          message: `${base}${assertionFailureSuffix(finding)}`,
          rule: ruleText,
          severity: 'error',
          symbol: errorSymbol,
        }),
      );
    }
  }

  return rows;
}

function renderLintAnalyzeExecutions(
  executions: Execution[] | undefined,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  resolveLocation: LocationResolver,
  runVersion: string | undefined,
): string[] {
  const groups = new Map<string, string[]>();

  for (const { execution } of walkExecutions(executions)) {
    if (execution.kind !== 'lint' && execution.kind !== 'analyze') {
      continue;
    }

    const rows = renderLintAnalyzeRow(execution, ruleIndex);
    if (rows.length === 0) {
      continue;
    }

    const location = resolveLocation(execution.location, runVersion);
    const groupRows = groups.get(location) ?? [];
    if (!groups.has(location)) {
      groups.set(location, groupRows);
    }
    groupRows.push(...rows);
  }

  const lines: string[] = [];
  for (const [location, rows] of groups) {
    lines.push(`  ${location}`);
    lines.push(...rows);
  }

  return lines;
}

function collectSeverityCounts(report: Report): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    error: 0,
    warn: 0,
    info: 0,
    hint: 0,
  };

  for (const run of report.runs) {
    const ruleIndex = buildRuleIndex(run.rules);
    for (const { execution } of walkExecutions(run.executions)) {
      const severity = resolveExecutionSeverity(execution, ruleIndex);
      if (severity !== undefined) {
        counts[severity] += 1;
      }
    }
  }

  return counts;
}

export function renderReport(
  report: Report,
  options: { format?: ThymianFormat } = {},
): string {
  if (report.runs.length === 0) {
    return 'No tool runs were reported.';
  }

  const lines: string[] = [];
  const reportForLocationResolution =
    options.format !== undefined
      ? { ...report, thymianFormat: { __cli: options.format.export() } }
      : report;
  const resolveLocation = createLocationResolver(reportForLocationResolution);

  for (const run of report.runs) {
    lines.push(
      `${run.tool.name} · ${run.runType} ${Array.from({
        length: Math.max(1, 75 - run.tool.name.length),
      })
        .map(() => '─')
        .join('')}`,
    );
    lines.push('');

    const ruleIndex = buildRuleIndex(run.rules);

    if (run.runType === 'lint' || run.runType === 'analyze') {
      lines.push(
        ...renderLintAnalyzeExecutions(
          run.executions,
          ruleIndex,
          resolveLocation,
          run.thymianFormatVersion,
        ),
      );
    } else {
      for (const { execution } of walkExecutions(run.executions)) {
        lines.push(
          ...renderTestExecution(
            execution,
            ruleIndex,
            resolveLocation,
            run.thymianFormatVersion,
          ),
        );
      }
    }

    lines.push('');
  }

  // Counts failed executions by resolved severity (see collectSeverityCounts /
  // resolveExecutionSeverity) — not `informational`-kind findings, which are
  // never counted here and can render in the body while this stays 0
  // (BaggersIO PR-311 finding 6). Labelled uniformly as severities, not
  // "finding(s)", to avoid implying otherwise.
  const counts = collectSeverityCounts(report);
  lines.push(
    `Summary: ${counts.error} error(s), ${counts.warn} warning(s), ${counts.hint} hint(s), ${counts.info} info(s).`,
  );

  return lines.join('\n').trimEnd();
}
