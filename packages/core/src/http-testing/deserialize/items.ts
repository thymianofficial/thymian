import type { ThymianSchema } from '../../format/thymian-schema.js';
import { deserialized, type DeserializedParameter } from './result.js';
import {
  deserializeScalar,
  itemSchema,
  propertySchema,
  schemaTypes,
  structuralKind,
} from './schema.js';

/**
 * The typing step, shared by every style.
 *
 * By the time this runs the style has already been reversed: `items` is the
 * list of scalar wire strings, and `raw` is the text the client sent with its
 * style packaging removed. This decides only what those strings mean —
 * array, object or scalar — and converts them.
 */

function deserializeArrayItems(
  items: string[],
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
): unknown[] {
  return items.map((item, index) =>
    deserializeScalar(item, itemSchema(schema, root, index), root),
  );
}

export function deserializeObjectEntries(
  entries: [string, string | string[]][],
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, raw] of entries) {
    const property = propertySchema(schema, root, key);
    const types = schemaTypes(property, root);
    const value =
      Array.isArray(raw) ||
      (types.includes('array') && !types.includes('string'))
        ? deserializeArrayItems(
            Array.isArray(raw) ? raw : [raw],
            property,
            root,
          )
        : deserializeScalar(raw as string, property, root);

    // `result[key] = …` would invoke the `__proto__` setter, replacing the
    // prototype and silently dropping the property instead of validating it.
    Object.defineProperty(result, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return result;
}

/** Pair up a flat `k,v,k,v` list. A dangling key means the value is malformed. */
function pairs(flat: string[]): [string, string][] | undefined {
  if (flat.length % 2 !== 0) {
    return undefined;
  }

  // A key carrying `=` means the value arrived in the EXPLODED form
  // (`role=admin,lvl=3`) while its description says otherwise. Pairing it up
  // would invent the property `"role=admin"` and quietly validate.
  for (let index = 0; index < flat.length; index += 2) {
    if ((flat[index] as string).includes('=')) {
      return undefined;
    }
  }

  const result: [string, string][] = [];

  for (let index = 0; index + 1 < flat.length; index += 2) {
    result.push([flat[index] as string, flat[index + 1] as string]);
  }

  return result;
}

/**
 * Shared typing step. `items` is the already-split, already-decoded list of
 * scalar wire strings for one parameter; `raw` is the value to fall back to
 * when the wire form is malformed for the declared type, so the schema — not
 * this module — gets to report it.
 */
export function deserializeItems(
  items: string[],
  raw: string | string[],
  schema: ThymianSchema | undefined,
  explode: boolean,
): DeserializedParameter {
  const types = schemaTypes(schema, schema);
  const kind = structuralKind(schema);

  // `string` wins over every structural interpretation, exactly as in
  // deserializeScalar: a description that accepts a string accepts this value.
  // Unless the value genuinely arrived as several occurrences and the schema
  // also allows an array — then no single string could ever represent it.
  if (
    types.includes('string') &&
    !(Array.isArray(raw) && types.includes('array'))
  ) {
    return deserialized(raw);
  }

  if (kind === 'array') {
    return deserialized(deserializeArrayItems(items, schema, schema));
  }

  if (kind === 'object') {
    const entries =
      explode && items.every((segment) => segment.includes('='))
        ? items.map((segment): [string, string] => {
            const separator = segment.indexOf('=');

            return [segment.slice(0, separator), segment.slice(separator + 1)];
          })
        : explode
          ? // A segment without `=` is not a valid exploded object form;
            // refuse to repair it, exactly as `pairs()` refuses a dangling key.
            undefined
          : pairs(items);

    // A malformed object form (a dangling key) must not be quietly repaired
    // into a valid object; hand the raw value to the schema instead.
    if (!entries) {
      return deserialized(raw);
    }

    return deserialized(deserializeObjectEntries(entries, schema, schema));
  }

  // A scalar parameter sent more than once is parameter pollution — a real
  // client defect. Handing the whole list to the schema keeps it reported,
  // as it was before deserialization existed.
  if (items.length > 1) {
    return deserialized(items);
  }

  return deserialized(deserializeScalar(items[0] ?? '', schema, schema));
}
