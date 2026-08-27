import { Errors } from '@oclif/core';

/**
 * Parse a typed-input flag value of the universal `<type>:<location>` format
 * (ADR-0017): split on the FIRST colon — the location may itself contain
 * colons (URLs, Windows paths) — both parts required, no extension sniffing,
 * no bare-path fallback. Single source of the parse rule for every typed
 * input flag (`--report`, `--spec`, `--traffic`, `--base`, `--head`), so the
 * rule and its error wording cannot drift between flags.
 */
export function parseTypedInput(
  input: string,
  flagName: string,
  example: string,
): { type: string; location: string } {
  const colonIndex = input.indexOf(':');
  const type = colonIndex === -1 ? '' : input.slice(0, colonIndex);
  const location = colonIndex === -1 ? '' : input.slice(colonIndex + 1);

  if (!type || !location) {
    throw new Errors.CLIError(
      `Invalid ${flagName} format: "${input}". Expected format: <type>:<location> (e.g. ${example}).`,
    );
  }

  return { type, location };
}
