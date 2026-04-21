import { Errors, Flags } from '@oclif/core';
import type { SpecificationInput } from '@thymian/core';

/**
 * Parse a `--spec` flag value of the format `<type>:<location>` into a SpecificationInput.
 * Both type and location are required.
 */
export function parseSpecFlag(input: string): SpecificationInput {
  const colonIndex = input.indexOf(':');

  if (colonIndex === -1) {
    throw new Errors.CLIError(
      `Invalid format: "${input}". Expected format: <type>:<location> (e.g. openapi:./openapi.yaml).`,
    );
  }

  const type = input.slice(0, colonIndex);
  const location = input.slice(colonIndex + 1);

  if (!type || !location) {
    throw new Errors.CLIError(
      `Invalid format: "${input}". Expected format: <type>:<location> (e.g. openapi:./openapi.yaml).`,
    );
  }

  return { type, location };
}

export const specFlag = Flags.custom<SpecificationInput>({
  description:
    'Specification input in the format <type>:<location> (e.g. openapi:./openapi.yaml).',
  multiple: true,
  helpValue: 'type:location',
  parse: async (input) => parseSpecFlag(input),
});
