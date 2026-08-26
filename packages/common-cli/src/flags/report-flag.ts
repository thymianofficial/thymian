import { Flags } from '@oclif/core';
import type { ReportInput } from '@thymian/core';

import { parseTypedInput } from './typed-input.js';

/**
 * Parse a `--report` flag value of the format `<type>:<location>` into a
 * ReportInput (ADR-0017 — see {@link parseTypedInput} for the parse rule).
 */
export function parseReportFlag(input: string): ReportInput {
  return parseTypedInput(input, '--report', 'spectral:./report.json');
}

export const reportFlag = Flags.custom<ReportInput>({
  description:
    'External report input in the format <type>:<location> (e.g. spectral:./report.json).',
  multiple: true,
  helpValue: 'type:location',
  parse: async (input) => parseReportFlag(input),
});
