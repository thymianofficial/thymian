import { isRecord } from '@thymian/core';

/**
 * Restores the boolean form of a schema that forbids everything.
 *
 * `additionalProperties: false` reaches the sampler as `{ not: {} }`, which is
 * the correct JSON Schema for it (`plugin-openapi`'s `normalizeSchema` turns
 * every boolean schema into its object form). Two consumers misread it, since
 * both treat any object in that position as a value schema:
 *
 * - the type emitter emits `[k: string]: { [k: string]: unknown }`, an index
 *   signature that every declared property then fails to satisfy — `TS2411`,
 *   six times over on the demo description;
 * - `openapi-sampler` invents `property1`, `property2` for it, which the same
 *   schema forbids.
 *
 * Handed the boolean, the emitter emits no index signature and the sampler
 * invents nothing, which is what a closed object is.
 *
 * Only this position is rewritten. `{ not: {} }` elsewhere means `never`, which
 * the emitter is free to render however it likes.
 */
export function closedObjectsToBoolean(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(closedObjectsToBoolean);
  }

  if (!isRecord(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    out[key] =
      key === 'additionalProperties' && forbidsEverything(value)
        ? false
        : closedObjectsToBoolean(value);
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
