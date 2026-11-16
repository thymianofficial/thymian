import { isRecord } from '@thymian/core';

/**
 * The positions where the boolean form of a forbidding schema changes what the
 * consumers produce.
 */
const CLOSING_KEYS = new Set(['additionalProperties', 'items']);

/**
 * Restores the boolean form of a schema that forbids everything.
 *
 * `false` reaches the sampler as `{ not: {} }`, which is the correct JSON
 * Schema for it (`plugin-openapi`'s `normalizeSchema` turns every boolean
 * schema into its object form). Two consumers misread it in two positions,
 * since both treat any object there as a value schema:
 *
 * - `additionalProperties`: `openapi-sampler` invents `property1`,
 *   `property2`, which the same schema forbids; the type emitter emits
 *   `[k: string]: { [k: string]: unknown }`, an index signature that every
 *   declared property then fails to satisfy — `TS2411`.
 * - `items`: `openapi-sampler` produces `[null]` where only `[]` is valid; the
 *   type emitter emits `{ [k: string]: unknown }[]` where `never[]` is correct.
 *
 * Handed the boolean, both get a closed object or a closed array right.
 *
 * Only these positions are rewritten, and never the root, which the emitter
 * cannot take as a boolean. `{ not: {} }` elsewhere means `never`, which the
 * emitter is free to render however it likes.
 */
export function closedSchemasToBoolean(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(closedSchemasToBoolean);
  }

  if (!isRecord(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    out[key] =
      CLOSING_KEYS.has(key) && forbidsEverything(value)
        ? false
        : closedSchemasToBoolean(value);
  }

  return out;
}

/** Whether a schema admits no value at all, in the shape normalization emits. */
function forbidsEverything(schema: unknown): boolean {
  return (
    isRecord(schema) &&
    Object.keys(schema).length === 1 &&
    isRecord(schema['not']) &&
    Object.keys(schema['not']).length === 0
  );
}
