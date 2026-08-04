import {
  errorSymbol,
  type FindingRecord,
  infoSymbol,
  type ReportAssertionFailure,
  successSymbol,
} from '@thymian/core';

import { indent, wrapIndented } from './utils.js';

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
      return wrapIndented(
        finding.title,
        `${indent(indentationLevel)}${infoSymbol} `,
      );
    case 'assertion-success':
      return wrapIndented(
        finding.title,
        `${indent(indentationLevel)}${successSymbol} `,
      );
    case 'assertion-failure': {
      const lines = wrapIndented(
        finding.title,
        `${indent(indentationLevel)}${errorSymbol} `,
      );
      const { expected, actual } = finding as ReportAssertionFailure;

      if (actual !== undefined && expected !== undefined) {
        lines.push(
          ...wrapIndented(
            `expected: ${JSON.stringify(expected)}`,
            indent(indentationLevel + 2),
          ),
        );
        lines.push(
          ...wrapIndented(
            `actual: ${JSON.stringify(actual)}`,
            indent(indentationLevel + 2),
          ),
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
        ? wrapIndented(
            finding.title,
            `${indent(indentationLevel)}${errorSymbol} `,
          )
        : [];
    default:
      // Superseded/unknown finding kinds are intentionally not rendered.
      return [];
  }
}
