import type {
  ThymianSchema,
  ThymianSchemaType,
} from '../../format/thymian-schema.js';

/**
 * Schema resolution and scalar typing.
 *
 * Everything here answers one of two questions about a parameter's schema:
 * *what type is this, really* (through `$ref`, `allOf`, `anyOf`/`oneOf`,
 * `enum`, `const`), and *is this wire string an unambiguous lexical form of
 * that type*. Nothing here knows about serialization styles.
 */

// A `$ref` chain or a self-referential `allOf` must not spin forever; parameter
// schemas are shallow, so a small bound is generous.
const MAX_SCHEMA_DEPTH = 12;

export function isSchema(value: unknown): value is ThymianSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolve a local JSON pointer (`#/$defs/Year`) against a schema root.
 * Traverses arrays too, so `#/$defs/T/anyOf/0` resolves; tokens are
 * percent-decoded before `~1`/`~0` unescaping, per RFC 6901.
 */
function resolvePointer(
  ref: string,
  root: ThymianSchema,
): ThymianSchema | undefined {
  if (ref === '#') {
    return root;
  }

  if (!ref.startsWith('#/')) {
    return undefined;
  }

  let node: unknown = root;

  for (const rawSegment of ref.slice(2).split('/')) {
    let segment = rawSegment;

    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      // Leave the token as written; a malformed escape simply will not match.
    }

    segment = segment.replace(/~1/g, '/').replace(/~0/g, '~');

    if (node === null || typeof node !== 'object') {
      return undefined;
    }

    node = (node as Record<string, unknown>)[segment];
  }

  return isSchema(node) ? node : undefined;
}

interface ResolvedSchema {
  schema: ThymianSchema;
  root: ThymianSchema;
}

/**
 * Follow `$ref`, keeping any sibling keywords (2020-12 allows them) and
 * rebasing the resolution root whenever the target carries its own `$defs`.
 */
function resolveRef(
  schema: ThymianSchema,
  root: ThymianSchema,
  depth: number,
): ResolvedSchema | undefined {
  // A subschema carrying its own `$defs` becomes the root for its own `$ref`s;
  // otherwise an `allOf` member that bundles both is unresolvable.
  const scope = schema.$defs ? schema : root;

  if (typeof schema.$ref !== 'string') {
    return { schema, root: scope };
  }

  if (depth >= MAX_SCHEMA_DEPTH) {
    return undefined;
  }

  const target = resolvePointer(schema.$ref, scope);

  if (!target) {
    return undefined;
  }

  const siblings: ThymianSchema = { ...schema };
  delete siblings.$ref;

  // KNOWN LIMIT: 2020-12 applies `$ref` and its siblings CONJUNCTIVELY; this
  // resolves them by override. It only diverges when a sibling contradicts the
  // target — `{$ref: X, type: 'integer'}` where X says `type: 'string'` — which
  // is a near-contradictory schema Ajv would reject outright. The override
  // decides the conversion while Ajv decides the verdict, so in that narrow
  // case the two disagree. Accepted deliberately over pulling in a dependency
  // (`json-schema-ref-resolver` refuses such schemas) for the handful of lines
  // it would save.
  const merged: ThymianSchema = { ...target, ...siblings };

  // `$ref: '#'` resolves to a root that still carries that same `$ref`; without
  // this the merge would re-resolve it forever, up to the depth bound.
  if (merged.$ref === schema.$ref) {
    delete merged.$ref;
  }

  return resolveRef(merged, target.$defs ? target : scope, depth + 1);
}

/**
 * Flatten `$ref` and `allOf` so the structural keywords this module reads
 * (`items`, `properties`, …) are visible on one object.
 */
export function flattenSchema(
  schema: ThymianSchema | undefined,
  root: ThymianSchema,
  depth = 0,
): ThymianSchema | undefined {
  if (!schema || depth >= MAX_SCHEMA_DEPTH) {
    return schema;
  }

  const resolved = resolveRef(schema, root, depth);

  if (!resolved) {
    return undefined;
  }

  const { schema: node, root: nodeRoot } = resolved;

  if (!Array.isArray(node.allOf)) {
    return node;
  }

  const merged: ThymianSchema = { ...node };
  delete merged.allOf;

  for (const member of node.allOf) {
    const flat = flattenSchema(member, nodeRoot, depth + 1);

    if (!flat) {
      continue;
    }

    // `allOf` is an intersection, so two members declaring `items` both apply.
    // Keeping only the first made `allOf: [{items: {minimum: 1}}, {items:
    // {type: 'integer'}}]` type its items off the typeless arm.
    merged.items = intersect(merged.items, flat.items);
    merged.prefixItems ??= flat.prefixItems;
    merged.contains ??= flat.contains;
    merged.enum ??= flat.enum;
    merged.const ??= flat.const;
    merged.anyOf ??= flat.anyOf;
    merged.oneOf ??= flat.oneOf;
    merged.additionalProperties ??= flat.additionalProperties;

    if (flat.properties) {
      const combined: Record<string, ThymianSchema> = { ...flat.properties };

      for (const [key, sub] of Object.entries(merged.properties ?? {})) {
        combined[key] = intersect(combined[key], sub) ?? sub;
      }

      merged.properties = combined;
    }

    if (flat.patternProperties) {
      merged.patternProperties = {
        ...flat.patternProperties,
        ...merged.patternProperties,
      };
    }
  }

  return merged;
}

/**
 * Combine two subschemas that both apply. Returns an `allOf` rather than
 * picking a winner, so no keyword is silently dropped.
 */
function intersect(
  left: ThymianSchema | undefined,
  right: ThymianSchema | undefined,
): ThymianSchema | undefined {
  if (!left || !right || left === right) {
    return left ?? right;
  }

  return { allOf: [left, right] };
}

/** Derive the JSON Schema types of concrete values, for `enum`/`const`. */
function typesFromValues(values: unknown[]): ThymianSchemaType[] {
  const types = new Set<ThymianSchemaType>();

  for (const value of values) {
    if (value === null) {
      types.add('null');
    } else if (typeof value === 'boolean') {
      types.add('boolean');
    } else if (typeof value === 'number') {
      types.add(Number.isInteger(value) ? 'integer' : 'number');
    } else if (typeof value === 'string') {
      types.add('string');
    } else if (Array.isArray(value)) {
      types.add('array');
    } else if (typeof value === 'object') {
      types.add('object');
    }
  }

  return [...types];
}

/**
 * The effective types of a schema, seen through `$ref`, `allOf`, `anyOf`,
 * `oneOf`, `enum` and `const`. A schema carrying none of these yields `[]`,
 * which means "do not convert".
 *
 * Exported because every structural decision — whether a wire value is a
 * delimited list, whether an object parameter needs folding — must ask the
 * same resolving question. A second, non-resolving copy of this logic is how
 * `$ref`ed parameters slipped through once already.
 */
export function schemaTypes(
  schema: ThymianSchema | undefined,
  root?: ThymianSchema,
  depth = 0,
): ThymianSchemaType[] {
  if (!schema || depth >= MAX_SCHEMA_DEPTH) {
    return [];
  }

  const resolved = resolveRef(schema, root ?? schema, depth);

  if (!resolved) {
    return [];
  }

  const { schema: node, root: nodeRoot } = resolved;

  if (typeof node.type === 'string') {
    return [node.type];
  }

  if (Array.isArray(node.type)) {
    return node.type;
  }

  if (Array.isArray(node.enum)) {
    return typesFromValues(node.enum);
  }

  if (node.const !== undefined) {
    return typesFromValues([node.const]);
  }

  // `allOf` means every member must validate, so the effective type is the
  // INTERSECTION. Taking the first declared type instead made the result
  // depend on member order.
  if (Array.isArray(node.allOf)) {
    const sets = node.allOf
      .map((member) => schemaTypes(member, nodeRoot, depth + 1))
      .filter((set) => set.length > 0);

    if (sets.length > 0) {
      return sets.reduce((left, right) =>
        left.filter((type) => right.includes(type)),
      );
    }
  }

  for (const composition of [node.anyOf, node.oneOf] as const) {
    if (Array.isArray(composition)) {
      const union = new Set(
        composition.flatMap((member) =>
          schemaTypes(member, nodeRoot, depth + 1),
        ),
      );

      if (union.size > 0) {
        return [...union];
      }
    }
  }

  return [];
}

/**
 * The schema governing array item `index`. `prefixItems` governs the leading
 * positions and `items` only the remainder, so prefix entries take precedence.
 * `contains` is deliberately NOT used: it is existential ("at least one item
 * matches"), not a per-item constraint.
 */
export function itemSchema(
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
  index: number,
): ThymianSchema | undefined {
  const flat = flattenSchema(schema, root ?? schema ?? {});

  return flat?.prefixItems?.[index] ?? flat?.items;
}

/** Compile a JSON Schema `pattern`, tolerating patterns Unicode mode rejects. */
function compilePattern(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, 'u');
  } catch {
    try {
      return new RegExp(pattern);
    } catch {
      return undefined;
    }
  }
}

/** The schema governing object property `key`, through `properties`/`patternProperties`/`additionalProperties`. */
export function propertySchema(
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
  key: string,
): ThymianSchema | undefined {
  const flat = flattenSchema(schema, root ?? schema ?? {});

  if (flat?.properties && Object.hasOwn(flat.properties, key)) {
    return flat.properties[key];
  }

  const matched = Object.entries(flat?.patternProperties ?? {})
    .filter(([pattern]) => compilePattern(pattern)?.test(key))
    .map(([, sub]) => sub);

  if (matched.length === 1) {
    return matched[0];
  }

  // Several patterns can match one key; all of them apply.
  if (matched.length > 1) {
    return { allOf: matched };
  }

  return isSchema(flat?.additionalProperties)
    ? flat.additionalProperties
    : undefined;
}

/** The `enum` of a schema, seen through `$ref`/`allOf`. */
export function enumMembers(
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
): unknown[] | undefined {
  const flat = flattenSchema(schema, root ?? schema ?? {});

  return Array.isArray(flat?.enum) ? flat.enum : undefined;
}

// Strict JSON number grammar. Deliberately NOT `Number(wire)`, which accepts
// '' (0), ' 12 ' (12), '0x10' (16) and 'Infinity'; and deliberately not a
// looser decimal pattern, which would accept '+5', '007', '.5' and '1.' —
// none of which any conforming serializer emits.
const INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;
const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/**
 * Convert a single wire string to the scalar type its schema declares.
 * Returns `wire` unchanged when the value is not a valid lexical form of any
 * declared type — that is what keeps `?year=abc` failing on `must be integer`
 * rather than silently becoming `NaN`.
 */
export function deserializeScalar(
  wire: string,
  schema: ThymianSchema | undefined,
  root?: ThymianSchema,
): unknown {
  const types = schemaTypes(schema, root ?? schema);

  // An `enum` names its permitted values outright. When exactly one of them
  // has this wire form, that member IS the value — otherwise a mixed enum such
  // as `['auto', 10, 20]` would take the `string` branch below and `?limit=10`
  // would fail enum membership as the string '10'.
  const members = enumMembers(schema, root ?? schema);

  if (members) {
    // Primitives only: an array member `[1,2]` stringifies to `'1,2'` and an
    // object to `'[object Object]'`, so a wire item spelled that way would
    // "match" a member it has no lexical relationship to.
    const matches = members.filter(
      (member) =>
        (typeof member !== 'object' || member === null) &&
        member !== null &&
        String(member) === wire,
    );

    if (matches.length === 1) {
      return matches[0];
    }
  }

  // A string is valid wherever `string` is allowed, so never convert away from
  // it — that would risk failing a value the description accepts as-is.
  if (types.length === 0 || types.includes('string')) {
    return wire;
  }

  if (types.includes('integer') && INTEGER_PATTERN.test(wire)) {
    const parsed = Number(wire);

    // Past 2^53 the conversion is lossy, and rounding an out-of-range int64
    // down onto its own `maximum` would turn a violation into a pass.
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  if (types.includes('number') && NUMBER_PATTERN.test(wire)) {
    const parsed = Number(wire);
    // Only the significand decides whether a written zero is really zero;
    // scanning the whole literal would reject the legitimate `0e5`.
    const significand = wire.split(/[eE]/)[0] ?? wire;

    // `1e999` overflows to Infinity and `1e-999` underflows to 0; past 2^53 the
    // conversion is lossy. All three would validate against constraints the
    // written value violates.
    if (
      Number.isFinite(parsed) &&
      (parsed !== 0 || !/[1-9]/.test(significand)) &&
      (Number.isSafeInteger(parsed) || !Number.isInteger(parsed))
    ) {
      return parsed;
    }
  }

  if (types.includes('boolean') && (wire === 'true' || wire === 'false')) {
    return wire === 'true';
  }

  return wire;
}

/**
 * Whether a wire value is a delimited list, and of what — the single accessor
 * every shape decision asks, so splitting and typing can never disagree.
 *
 * A schema often omits `type` while still being unambiguously structured:
 * `{ properties: {...}, required: [...] }` is an object, `{ items: {...} }` is
 * an array. Requiring a literal `type` made those look like scalars, so the
 * value was never split and `properties`/`items` never applied — a violation
 * passed clean. Structural keywords therefore count as evidence of shape.
 *
 * `string` still wins over everything: a description that accepts a string
 * accepts the value whole, and must never see it torn apart on a delimiter it
 * legitimately contains.
 */
export function structuralKind(
  schema: ThymianSchema | undefined,
  root?: ThymianSchema,
): 'array' | 'object' | undefined {
  const types = schemaTypes(schema, root ?? schema);

  if (types.includes('string')) {
    return undefined;
  }

  // Array before object, in both this and every caller: a schema that unions
  // the two must resolve the same way wherever the question is asked.
  if (types.includes('array')) {
    return 'array';
  }

  if (types.includes('object')) {
    return 'object';
  }

  // A declared scalar type is a scalar; only a type-less schema falls through
  // to structural inference.
  if (types.length > 0) {
    return undefined;
  }

  const flat = flattenSchema(schema, root ?? schema ?? {});

  if (flat?.items ?? flat?.prefixItems ?? flat?.contains) {
    return 'array';
  }

  if (
    flat?.properties ??
    flat?.patternProperties ??
    (flat?.additionalProperties !== undefined ? {} : undefined)
  ) {
    return 'object';
  }

  return undefined;
}

/** Types that make the wire value a delimited list rather than one scalar. */
export function isStructural(schema: ThymianSchema | undefined): boolean {
  return structuralKind(schema) !== undefined;
}
