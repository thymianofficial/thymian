import { Flags } from '@oclif/core';
import type { TrafficInput } from '@thymian/core';

import { parseTypedInput } from './typed-input.js';

/**
 * Parse a `--traffic` flag value of the format `<type>:<location>` into a
 * TrafficInput (ADR-0017 — see {@link parseTypedInput}).
 */
export function parseTrafficFlag(input: string): TrafficInput {
  return parseTypedInput(input, '--traffic', 'har:./traffic.har');
}

export const trafficFlag = Flags.custom<TrafficInput>({
  description:
    'Traffic input in the format <type>:<location> (e.g. har:./traffic.har).',
  multiple: true,
  helpValue: 'type:location',
  helpGroup: 'BASE',
  parse: async (input) => parseTrafficFlag(input),
});
