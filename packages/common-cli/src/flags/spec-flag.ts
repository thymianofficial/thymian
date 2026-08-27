import { Flags } from '@oclif/core';
import type { SpecificationInput } from '@thymian/core';

import { parseTypedInput } from './typed-input.js';

/**
 * Parse a `--spec` flag value of the format `<type>:<location>` into a
 * SpecificationInput (ADR-0017 — see {@link parseTypedInput}).
 */
export function parseSpecFlag(input: string): SpecificationInput {
  return parseTypedInput(input, '--spec', 'openapi:./openapi.yaml');
}

export const specFlag = Flags.custom<SpecificationInput>({
  description:
    'Specification input in the format <type>:<location> (e.g. openapi:./openapi.yaml).',
  multiple: true,
  helpValue: 'type:location',
  parse: async (input) => parseSpecFlag(input),
});
