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
): string[] {
  return findings.flatMap((finding) =>
    renderFinding(finding, indentationLevel),
  );
}

function renderFinding(
  finding: FindingRecord,
  indentationLevel: number,
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

      if (expected && actual) {
        lines.push(
          `${indent(indentationLevel + 2)}expected: ${truncate(JSON.stringify(expected))}`,
        );
        lines.push(
          `${indent(indentationLevel + 2)}actual: ${truncate(JSON.stringify(actual))}`,
        );
      }

      return lines;
    }
    case 'rule-violation':
      // Rule identity and outcome render at the execution level, so the
      // rule-violation finding itself has no additional body to render.
      return [];
    default:
      // Superseded/unknown finding kinds are intentionally not rendered.
      return [];
  }
}

export function truncate(str: string, maxLength = 30): string {
  return str.length > maxLength
    ? str.substring(0, maxLength - 4) + ' ...'
    : str;
}
