import {
  errorSymbol,
  type FindingRecord,
  infoSymbol,
  type ReportAssertionFailure,
  successSymbol,
} from '@thymian/core';

import { indent } from './utils.js';

export function renderFindings(
  findings: FindingRecord[],
  indentationLevel: number,
  options: { renderRuleViolationTitle?: boolean } = {},
): string[] {
  return findings.flatMap((finding) =>
    renderFinding(finding, indentationLevel, options),
  );
}

function renderFinding(
  finding: FindingRecord,
  indentationLevel: number,
  options: { renderRuleViolationTitle?: boolean },
): string[] {
  switch (finding.kind) {
    case 'informational':
      return [indent(indentationLevel) + `${infoSymbol} ${finding.title}`];
    case 'assertion-success':
      return [indent(indentationLevel) + `${successSymbol} ${finding.title}`];
    case 'assertion-failure': {
      const lines = [
        indent(indentationLevel) + `${errorSymbol} ${finding.title}`,
      ];
      const { expected, actual } = finding as ReportAssertionFailure;

      if (actual !== undefined && expected !== undefined) {
        lines.push(
          `${indent(indentationLevel + 2)}expected: ${JSON.stringify(expected)}`,
        );
        lines.push(
          `${indent(indentationLevel + 2)}actual: ${JSON.stringify(actual)}`,
        );
      }

      return lines;
    }
    case 'rule-violation':
      // For single-step test cases (and lint/analyze), rule identity and
      // outcome already render at the execution level via the status line.
      // In multi-step test cases only the first step's violation message
      // reaches that status line, so render each step's title here to avoid
      // silently dropping the other steps' violations.
      return options.renderRuleViolationTitle
        ? [indent(indentationLevel) + `${errorSymbol} ${finding.title}`]
        : [];
    default:
      // Superseded/unknown finding kinds are intentionally not rendered.
      return [];
  }
}
