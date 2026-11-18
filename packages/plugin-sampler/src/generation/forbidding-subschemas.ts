import { isRecord } from '@thymian/core';

/**
 * The keywords where the boolean form of a forbidding subschema changes what
 * the consumers produce.
 */
const FORBIDDING_SUBSCHEMA_KEYWORDS = new Set([
  'additionalProperties',
  'items',
]);

/**
 * The keywords holding a name-to-schema map, where a member's name is not a
 * keyword. Keep in step with `NESTED_SCHEMA.map` in `types/schema-type.ts`.
 */
const NAME_MAP_KEYWORDS = new Set([
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
]);

/**
 * Restores the boolean form of a forbidding subschema where consumers misread
 * its object form.
 *
 * `false` reaches the sampler as `{ not: {} }`, which is the correct JSON
 * Schema for it (`plugin-openapi`'s `normalizeSchema` turns every boolean
 * schema into its object form). Two consumers misread a forbidding subschema
 * at two keywords, since both treat any object there as a value schema:
 *
 * - `additionalProperties`: `openapi-sampler` invents `property1`,
 *   `property2`, which the same schema forbids; the type emitter emits
 *   `[k: string]: { [k: string]: unknown }`, an index signature that every
 *   declared property then fails to satisfy — `TS2411`.
 * - `items`: `openapi-sampler` produces `[null]` where only `[]` is valid; the
 *   type emitter emits `{ [k: string]: unknown }[]` where `never[]` is correct.
 *
 * Handed the boolean, both produce a closed object or a closed array.
 *
 * Only a forbidding subschema at these keywords is rewritten, and never the
 * root, which the emitter cannot take as a boolean. A forbidding subschema
 * elsewhere means `never`, which the emitter is free to render however it
 * likes.
 *
 * The walk matches on names, except that a member of a name map (`$defs`,
 * `properties`, …) is never taken for a keyword: a property or definition
 * named `items` keeps its schema, and only its value is walked.
 */
export function forbiddingSubschemasToBoolean(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(forbiddingSubschemasToBoolean);
  }

  if (!isRecord(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (NAME_MAP_KEYWORDS.has(key) && isRecord(value)) {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([name, member]) => [
          name,
          forbiddingSubschemasToBoolean(member),
        ]),
      );
    } else {
      out[key] =
        FORBIDDING_SUBSCHEMA_KEYWORDS.has(key) && forbidsEverything(value)
          ? false
          : forbiddingSubschemasToBoolean(value);
    }
  }

  return out;
}

/**
 * Whether a schema is a forbidding subschema: one that admits no value at
 * all, in the shape normalization emits (`{ not: {} }`).
 */
function forbidsEverything(schema: unknown): boolean {
  return (
    isRecord(schema) &&
    Object.keys(schema).length === 1 &&
    isRecord(schema['not']) &&
    Object.keys(schema['not']).length === 0
  );
}
