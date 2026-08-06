import { Errors, Flags } from '@oclif/core';
import type { ReportInput } from '@thymian/core';

/**
 * Parse a `--report` flag value of the format `<type>:<location>` into a ReportInput.
 * Both type and location are required (ADR-0017: no extension sniffing, no
 * bare-path fallback); the location may itself contain colons (URLs, Windows paths).
 */
export function parseReportFlag(input: string): ReportInput {
  const colonIndex = input.indexOf(':');

  if (colonIndex === -1) {
    throw new Errors.CLIError(
      `Invalid --report format: "${input}". Expected format: <type>:<location> (e.g. spectral:./report.json).`,
    );
  }

  const type = input.slice(0, colonIndex);
  const location = input.slice(colonIndex + 1);

  if (!type || !location) {
    throw new Errors.CLIError(
      `Invalid --report format: "${input}". Expected format: <type>:<location> (e.g. spectral:./report.json).`,
    );
  }

  return { type, location };
}

export const reportFlag = Flags.custom<ReportInput>({
  description:
    'External report input in the format <type>:<location> (e.g. spectral:./report.json).',
  multiple: true,
  helpValue: 'type:location',
  parse: async (input) => parseReportFlag(input),
});
