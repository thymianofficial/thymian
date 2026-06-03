import { colorize } from '@oclif/core/ux';
import {
  isNodeType,
  ThymianFormat,
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
  type FindingRecord,
  type HttpTransaction,
  type Location,
  type Report,
  type Severity,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
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
  const headline = `${symbolForSeverity(finding.severity)} ${finding.title}`;
  const lines = [
    `${indent}${colorizeText(headline, finding.severity)}${
      'ruleId' in finding ? ` ${finding.ruleId}` : ''
    }`,
  ];

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
    const skipped = finding as Extract<FindingRecord, { kind: 'test-case-skip' }>;
    lines.push(`${indent}  reason: ${skipped.reason}`);
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

  const visit = (executions: Report['runs'][number]['executions']): void => {
    for (const execution of executions ?? []) {
      for (const finding of execution.findings) {
        counts[finding.severity] += 1;
      }
      visit(execution.children);
    }
  };

  for (const run of report.runs) {
    visit(run.executions);
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
  const format =
    options.format ??
    (report.thymianFormat ? ThymianFormat.import(report.thymianFormat) : undefined);

  for (const run of report.runs) {
    lines.push(
      `${run.tool.name} ${Array.from({
        length: Math.max(1, 80 - run.tool.name.length),
      })
        .map(() => '─')
        .join('')}`,
    );
    lines.push('');

    for (const execution of run.executions ?? []) {
      lines.push(`  ${formatLocation(execution.location, format)}`);
      for (const finding of execution.findings) {
        lines.push(...renderFinding(finding));
      }
      for (const child of execution.children ?? []) {
        lines.push(`    ${formatLocation(child.location, format)}`);
        for (const finding of child.findings) {
          lines.push(...renderFinding(finding, '      '));
        }
      }
    }

    lines.push('');
  }

  const counts = collectSeverityCounts(report);
  lines.push(
    `Summary: ${counts.error} error(s), ${counts.warn} warning(s), ${counts.hint} hint(s), ${counts.info} info finding(s).`,
  );

  return lines.join('\n').trimEnd();
}
