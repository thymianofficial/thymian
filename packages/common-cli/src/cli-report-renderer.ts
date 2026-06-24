import { colorize } from '@oclif/core/ux';
import {
  buildRuleIndex,
  collectFindings,
  type FindingRecord,
  findingDetails,
  findingRuleId,
  type HttpTransaction,
  isNodeType,
  type Location,
  type Report,
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

function renderFinding(
  finding: FindingRecord,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  indent = '    ',
): string[] {
  const headline = `${symbolForSeverity(finding.severity)} ${finding.title}`;
  const ruleId = findingRuleId(finding);
  const lines = [
    `${indent}${colorizeText(headline, finding.severity)}${
      ruleId ? ` ${ruleId}` : ''
    }`,
  ];

  if (finding.message?.text && finding.message.text !== finding.title) {
    lines.push(`${indent}  ${finding.message.text}`);
  }

  for (const detail of findingDetails(finding, ruleIndex)) {
    // `rule` is already shown inline on the headline above.
    if (detail.label === 'rule') {
      continue;
    }
    lines.push(`${indent}  ${detail.label}: ${detail.value}`);
  }

  for (const relationship of finding.nestedFindings ?? []) {
    lines.push(...renderFinding(relationship.finding, ruleIndex, `${indent}  `));
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
    for (const finding of collectFindings(run.executions, {
      includeNested: true,
    })) {
      counts[finding.severity] += 1;
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
  const format =
    options.format ??
    (report.thymianFormat
      ? ThymianFormat.import(report.thymianFormat)
      : undefined);

  for (const run of report.runs) {
    lines.push(
      `${run.tool.name} ${Array.from({
        length: Math.max(1, 80 - run.tool.name.length),
      })
        .map(() => '─')
        .join('')}`,
    );
    lines.push('');

    const ruleIndex = buildRuleIndex(run.rules);
    for (const { execution, depth } of walkExecutions(run.executions)) {
      const indent = '  '.repeat(depth + 1);
      lines.push(`${indent}${formatLocation(execution.location, format)}`);
      for (const finding of execution.findings) {
        lines.push(...renderFinding(finding, ruleIndex, `${indent}  `));
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
