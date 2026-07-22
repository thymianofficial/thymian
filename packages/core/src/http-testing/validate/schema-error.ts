import type { ErrorObject } from 'ajv';

/**
 * Convert an ajv `instancePath` (a JSON pointer such as `/user/age` or
 * `/items/2/id`) to a readable property path (`user.age`, `items[2].id`).
 * Numeric segments render as array indices. Returns an empty string for the root.
 */
function instancePathToProperty(instancePath: string): string {
  if (!instancePath) {
    return '';
  }

  const segments = instancePath
    .split('/')
    .filter((segment) => segment.length > 0)
    // Un-escape JSON pointer tokens (`~1` → `/`, `~0` → `~`).
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

  let path = '';
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      path += `[${segment}]`;
    } else {
      path += path.length > 0 ? `.${segment}` : segment;
    }
  }
  return path;
}

/**
 * Describe a schema-validation error in plain English, answering both *where* the
 * problem is and *what* it is.
 *
 * When the error targets a property, the message names that property path (e.g.
 * `property "user.age" must be integer`, `property "items[2].id" must be integer`,
 * `property "user.name" is required`). When it targets a single value with no
 * property context (e.g. a header or parameter value), it falls back to the given
 * `subject` (e.g. `header "x-count" must match pattern "^[0-9]+$"`).
 */
export function describeSchemaError(
  error: ErrorObject,
  subject?: string,
): string {
  const base = instancePathToProperty(error.instancePath);

  if (error.keyword === 'required') {
    const missing = (error.params as { missingProperty?: string })
      .missingProperty;
    const path = base ? `${base}.${missing}` : missing;
    return path
      ? `property "${path}" is required`
      : 'a required property is missing';
  }

  if (
    error.keyword === 'additionalProperties' ||
    error.keyword === 'unevaluatedProperties'
  ) {
    const params = error.params as {
      additionalProperty?: string;
      unevaluatedProperty?: string;
    };
    const extra = params.additionalProperty ?? params.unevaluatedProperty;
    const prop = base && extra ? `${base}.${extra}` : (extra ?? base);
    return prop
      ? `property "${prop}" is not allowed`
      : subject
        ? `${subject} has an unexpected property`
        : 'an unexpected property is present';
  }

  const what = error.message ?? 'is invalid';

  if (base) {
    return `property "${base}" ${what}`;
  }

  return subject ? `${subject} ${what}` : what;
}

/**
 * Keywords whose failing `error.schema`/`params.limit` is a numeric bound rather
 * than an expected value, so they must not produce an `expected`/`actual` pair.
 */
const BOUNDARY_KEYWORDS = new Set<string>([
  'maxLength',
  'minLength',
  'maximum',
  'minimum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'maxItems',
  'minItems',
  'maxProperties',
  'minProperties',
]);

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Derive `expected`/`actual` detail for a schema error, for renderers that show
 * them as a pair. Requires ajv `verbose` (so `error.data`/`error.schema` are
 * populated). Returns nothing for `required` (no value was present) or when the
 * offending value is not a scalar (the property path already localizes it) or no
 * concrete expectation can be derived.
 */
export function schemaErrorDetail(error: ErrorObject): {
  expected?: unknown;
  actual?: unknown;
} {
  if (error.keyword === 'required') {
    return {};
  }

  const actual = isPrimitive(error.data) ? error.data : undefined;
  if (actual === undefined) {
    return {};
  }

  // Boundary keywords express a limit, not an expected value: ajv sets
  // `params.limit` (and `error.schema`) to the bound, so pairing it as
  // `expected` would mislabel e.g. `maxLength: 3` on "abcd" as
  // `expected: 3, actual: "abcd"`. The human-readable message already states
  // the bound ("must NOT have more than 3 characters"), so emit no pair here.
  if (BOUNDARY_KEYWORDS.has(error.keyword)) {
    return {};
  }

  const params = error.params as Record<string, unknown>;
  const expected =
    params.type ??
    params.allowedValues ??
    params.allowedValue ??
    params.pattern ??
    params.format ??
    (isPrimitive(error.schema) ? error.schema : undefined);

  return expected !== undefined ? { expected, actual } : {};
}
