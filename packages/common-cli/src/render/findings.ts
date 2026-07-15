import {
  errorSymbol,
  type FindingRecord,
  infoSymbol,
  successSymbol,
} from '@thymian/core';

import { indent } from './utils.js';

export function renderFindings(
  findings: FindingRecord[],
  indentationLevel: number,
): string[] {
  return findings
    .map((finding) => {
      if (finding.kind === 'informational') {
        return `${infoSymbol} ${finding.title}`;
      } else if (finding.kind === 'assertion-success') {
        return `${successSymbol} ${finding.title}`;
      } else if (finding.kind === 'assertion-failure') {
        return `${errorSymbol} ${finding.title}`;
      } else if (finding.kind === 'rule-violation') {
        return ``;
      } else {
        // default to info symbol for unknown findings
        return `${infoSymbol} ${finding.title}`;
      }
    })
    .filter(Boolean)
    .map((finding) => indent(indentationLevel) + finding);
}
