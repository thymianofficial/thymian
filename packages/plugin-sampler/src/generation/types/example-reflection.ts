import { isRecord } from '@thymian/core';

/**
 * Reflects a schema's `examples` into the types its properties get.
 *
 * **Property-level only.** An example value pushes down into the property (or
 * array element type) it belongs to, recursively, and a primitive property with
 * examples becomes `'A' | 'B' | (base & {})` — the literals autocomplete while
 * the type stays open.
 *
 * An object body is **never** emitted as a union of example-shaped object types,
 * and that is not a stylistic preference. Hooks mutate the request in place, and
 * on a union TypeScript checks a property *write* against the intersection of
 * the members' property types and rejects any property missing from a member —
 * so a union of closed example objects turns ordinary mutation into a compile
 * error. That is exactly the flaw the earlier attempt shipped.
 *
 * The mechanism is `json-schema-to-typescript`'s `tsType` keyword: the schema is
 * annotated and the emitter prints the annotation verbatim, so nothing here has
 * to know how a schema becomes a type.
 */
export function reflectExamples(schema: unknown): unknown {
  return annotate(schema, []);
}

/** The examples a schema node declares, in the order it declared them. */
function examplesOf(node: Record<string, unknown>): unknown[] {
  const fromPlural = Array.isArray(node['examples']) ? node['examples'] : [];
  const fromSingular = 'example' in node ? [node['example']] : [];

  return [...fromPlural, ...fromSingular];
}

function annotate(schema: unknown, inherited: unknown[]): unknown {
  if (!isRecord(schema)) {
    return schema;
  }

  const node: Record<string, unknown> = { ...schema };
  const examples = [...examplesOf(node), ...inherited];

  // `enum` and `const` are already closed unions, and widening them with
  // `(base & {})` would say the opposite of what the description says.
  const closed = 'enum' in node || 'const' in node;

  if (isRecord(node['properties'])) {
    const properties: Record<string, unknown> = {};

    for (const [name, property] of Object.entries(node['properties'])) {
      properties[name] = annotate(
        property,
        // An object example is not a type: it is a set of property examples,
        // one level down.
        examples
          .filter(isRecord)
          .filter((example) => name in example)
          .map((example) => example[name]),
      );
    }

    node['properties'] = properties;
  }

  if (node['items'] !== undefined) {
    node['items'] = annotate(
      node['items'],
      // Likewise an array example: element examples, one level down.
      examples.filter(Array.isArray).flat(),
    );
  }

  if (!closed) {
    const literals = openLiteralUnion(node, examples);

    if (literals) {
      node['tsType'] = literals;
    }
  }

  return node;
}

/**
 * `'A' | 'B' | (base & {})` for a primitive node with examples, or `undefined`
 * when there is nothing to reflect.
 *
 * The `& {}` is what keeps the union open: without it TypeScript widens the
 * whole thing back to `string` and the literals stop autocompleting.
 */
function openLiteralUnion(
  node: Record<string, unknown>,
  examples: readonly unknown[],
): string | undefined {
  const base = primitiveBase(node);

  if (!base) {
    return undefined;
  }

  const literals = [
    ...new Set(
      examples
        .filter((example) => typeof example === base)
        .map((example) => JSON.stringify(example)),
    ),
  ];

  if (literals.length === 0) {
    return undefined;
  }

  return `${literals.join(' | ')} | (${base} & {})`;
}

/** The TypeScript primitive a node describes, if it describes exactly one. */
function primitiveBase(
  node: Record<string, unknown>,
): 'string' | 'number' | undefined {
  const type = node['type'];

  if (type === 'string') {
    return 'string';
  }

  if (type === 'number' || type === 'integer') {
    return 'number';
  }

  return undefined;
}
