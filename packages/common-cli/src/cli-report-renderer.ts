import { colorize } from '@oclif/core/ux';
import {
  buildRuleIndex,
  type Execution,
  type ExecutionStatus,
  findingDetails,
  type FindingRecord,
  type HttpTransaction,
  isNodeType,
  type Location,
  type Report,
  resolveExecutionSeverity,
  type RuleDescriptor,
  type Severity,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
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

function fallbackThymianFormatLocation(
  location: Extract<Location, { type: 'thymianFormat' }>,
): string {
  return `format:${location.elementId}${location.pointer ? `#${location.pointer}` : ''}`;
}

function formatThymianFormatLocation(
  location: Extract<Location, { type: 'thymianFormat' }>,
  format?: ThymianFormat,
): string {
  if (!format) {
    return fallbackThymianFormatLocation(location);
  }

  if (location.elementType === 'node') {
    const node = format.getNode(location.elementId);

    if (node && isNodeType(node, 'http-request')) {
      return thymianRequestToString(node);
    }

    if (node && isNodeType(node, 'http-response')) {
      return thymianResponseToString(node);
    }

    return fallbackThymianFormatLocation(location);
  }

  try {
    const [source, target] = format.graph.extremities(location.elementId);
    const transaction = format.getEdge<HttpTransaction>(location.elementId);
    const request = format.getNode<ThymianHttpRequest>(source);
    const response = format.getNode<ThymianHttpResponse>(target);

    if (transaction && request && response) {
      return thymianHttpTransactionToString(request, response);
    }
  } catch {
    return fallbackThymianFormatLocation(location);
  }

  return fallbackThymianFormatLocation(location);
}

function formatLocation(location: Location, format?: ThymianFormat): string {
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
      return formatThymianFormatLocation(location, format);
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

/** Resolve the ThymianFormat a given run used, from the report's version map. */
function resolveRunFormat(
  formats: Report['thymianFormat'],
  version: string | undefined,
): ThymianFormat | undefined {
  if (!formats) {
    return undefined;
  }

  const entries = Object.entries(formats);
  const serialized =
    version !== undefined && formats[version]
      ? formats[version]
      : entries.length === 1
        ? entries[0]?.[1]
        : undefined;

  return serialized ? ThymianFormat.import(serialized) : undefined;
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
      resolveRunFormat(report.thymianFormat, run.thymianFormatVersion);

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

  const counts = collectSeverityCounts(report);
  lines.push(
    `Summary: ${counts.error} error(s), ${counts.warn} warning(s), ${counts.hint} hint(s), ${counts.info} info finding(s).`,
  );

  return lines.join('\n').trimEnd();
}
