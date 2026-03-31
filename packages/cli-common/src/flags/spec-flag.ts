import { Errors, Flags } from '@oclif/core';
import type { SpecificationInput } from '@thymian/core';

/**
 * Parse a `--spec` flag value of the format `[<type>:]<location>` into a SpecificationInput.
 * The type is optional and defaults to `openapi`.
 */
export function parseSpecFlag(input: string): SpecificationInput {
  const colonIndex = input.indexOf(':');

  if (colonIndex === -1) {
    return { type: 'openapi', location: input };
  }

  const type = input.slice(0, colonIndex);
  const location = input.slice(colonIndex + 1);

  if (!type || !location) {
    throw new Errors.CLIError(
      `Invalid --spec format: "${input}". Expected format: [<type>:]<location> (e.g. openapi:./openapi.yaml or ./openapi.yaml).`,
    );
  }

  return { type, location };
}

export const specFlag = Flags.custom<SpecificationInput>({
  description:
    'Specification input in the format [<type>:]<location>. Type defaults to "openapi" if omitted (e.g. openapi:./openapi.yaml or ./openapi.yaml).',
  multiple: true,
  helpValue: '[type:]location',
  helpGroup: 'BASE',
  parse: async (input) => parseSpecFlag(input),
});
