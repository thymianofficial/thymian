import { colorize } from '@oclif/core/ux';
import {
  buildRuleIndex,
  type Execution,
  type ExecutionStatus,
  findingDetails,
  type FindingRecord,
  formatLocation,
  type Report,
  resolveExecutionSeverity,
  resolveThymianFormatForRun,
  type RuleDescriptor,
  type Severity,
  type ThymianFormat,
  walkExecutions,
} from '@thymian/core';

const COLORS: Record<Severity, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  hint: 'blue',
};

function colorizeText(text: string, severity: Severity): string {
  if (!process.stdout.isTTY) {
    return text;
  }

  return colorize(COLORS[severity], text);
}

function symbolForSeverity(severity: Severity): string {
  switch (severity) {
    case 'error':
      return '✖';
    case 'warn':
      return '⚠';
    case 'hint':
      return 'ℹ';
    case 'info':
      return '•';
  }
}

function renderFinding(finding: FindingRecord, indent = '    '): string[] {
  const lines = [`${indent}${finding.title}`];

  if (finding.message?.text && finding.message.text !== finding.title) {
    lines.push(`${indent}  ${finding.message.text}`);
  }

  for (const detail of findingDetails(finding)) {
    lines.push(`${indent}  ${detail.label}: ${detail.value}`);
  }

  return lines;
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
      return `${symbolForSeverity('info')} passed${duration}`;
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
      return `${symbolForSeverity('hint')} skipped${status.reason ? `: ${status.reason}` : ''}`;
  }
}

function renderExecution(
  execution: Execution,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  format: ThymianFormat | undefined,
): string[] {
  const label =
    execution.kind === 'test'
      ? execution.name
      : formatLocation(execution.location, format);
  const lines = [`  ${label}${execution.ruleId ? ` ${execution.ruleId}` : ''}`];

  const severity = resolveExecutionSeverity(execution, ruleIndex);
  lines.push(`    ${renderStatus(execution.status, severity)}`);

  if (execution.kind === 'test') {
    for (const step of execution.steps) {
      if (step.findings.length === 0) {
        continue;
      }
      lines.push(`    ${step.name} ${formatLocation(step.location, format)}`);
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

  for (const run of report.runs) {
    const format =
      options.format ??
      resolveThymianFormatForRun(
        report.thymianFormat,
        run.thymianFormatVersion,
      );

    lines.push(
      `${run.tool.name} ${Array.from({
        length: Math.max(1, 80 - run.tool.name.length),
      })
        .map(() => '─')
        .join('')}`,
    );
    lines.push('');

    const ruleIndex = buildRuleIndex(run.rules);
    for (const { execution } of walkExecutions(run.executions)) {
      lines.push(...renderExecution(execution, ruleIndex, format));
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
