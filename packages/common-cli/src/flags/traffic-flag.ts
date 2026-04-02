import { Errors, Flags } from '@oclif/core';
import type { TrafficInput } from '@thymian/core';

/**
 * Parse a `--traffic` flag value of the format `<type>:<location>` into a TrafficInput.
 */
export function parseTrafficFlag(input: string): TrafficInput {
  const colonIndex = input.indexOf(':');

  if (colonIndex === -1) {
    throw new Errors.CLIError(
      `Invalid --traffic format: "${input}". Expected format: <type>:<location> (e.g. har:./traffic.har).`,
    );
  }

  const type = input.slice(0, colonIndex);
  const location = input.slice(colonIndex + 1);

  if (!type || !location) {
    throw new Errors.CLIError(
      `Invalid --traffic format: "${input}". Expected format: <type>:<location> (e.g. har:./traffic.har).`,
    );
  }

  return { type, location };
}

export const trafficFlag = Flags.custom<TrafficInput>({
  description:
    'Traffic input in the format <type>:<location> (e.g. har:./traffic.har).',
  multiple: true,
  helpValue: 'type:location',
  helpGroup: 'BASE',
  parse: async (input) => parseTrafficFlag(input),
});
