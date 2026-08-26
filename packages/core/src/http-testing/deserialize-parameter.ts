import type {
  SerializationStyle,
  Style,
} from '../format/serialization-style/index.js';
import type {
  ThymianSchema,
  ThymianSchemaType,
} from '../format/thymian-schema.js';

/**
 * The inverse of `serialize-parameter.ts`.
 *
 * Parameter values are strings on the wire by definition — OpenAPI's
 * `style`/`explode` rules describe how typed values are *serialized into* them.
 * Validating the wire form against the parameter's schema therefore reports
 * every non-string parameter as a type violation. These helpers rebuild the
 * typed value first, so the schema is validated against what the description
 * actually describes.
 *
 * Deserialization is **schema-directed and conservative**: it converts only
 * when the wire form is an unambiguous lexical representation of the target
 * type, and otherwise returns the string untouched so the genuine schema error
 * still fires. It never guesses a type from the value alone.
 *
 * **Splitting happens before decoding, and only when the schema calls for it.**
 * `?ids=a%2Cb` is one item, not two, so a delimiter is split on the encoded
 * form and each item decoded afterwards — the query orchestrator does this for
 * non-exploded arrays (it alone holds the raw query string), while the path and
 * header helpers take a decoder and split internally. A `string`-typed
 * parameter is never split at all: `Date: Mon, 02 Jan 2026` is one value.
 */

/**
 * A wire value that was not deserialized. Two distinct situations, deliberately
 * kept apart because they blame different parties:
 *
 * - `malformed: false` — **thymian's** limitation. It cannot reverse this
 *   style, so the value went unchecked. Reported as `info`; the request may be
 *   perfectly correct.
 * - `malformed: true` — the **request's** defect. thymian can reverse this
 *   style, and this value is not in it. Reported as an `assertion-failure`,
 *   because a value not serialized per its description does not conform to it.
 */
export interface UnsupportedSerialization {
  supported: false;
  style: Style;
  explode: boolean;
  malformed?: boolean;
}

export interface DeserializedParameter {
  supported: true;
  value: unknown;
}

export type DeserializeResult =
  DeserializedParameter | UnsupportedSerialization;

function unsupported({
  style,
  explode,
}: SerializationStyle): UnsupportedSerialization {
  return { supported: false, style, explode };
}

/** The style is reversible; this particular value is not in it. */
function malformed({
  style,
  explode,
}: SerializationStyle): UnsupportedSerialization {
  return { supported: false, style, explode, malformed: true };
}

// `Parameter.style` is typed non-optional, but these helpers are reached with
// whatever a plugin or fixture actually built. A missing style is the location
// default, not a crash.
const QUERY_DEFAULT_STYLE: SerializationStyle = {
  style: 'form',
  explode: true,
};
const SIMPLE_DEFAULT_STYLE: SerializationStyle = {
  style: 'simple',
  explode: false,
};

function deserialized(value: unknown): DeserializedParameter {
  return { supported: true, value };
}

// A `$ref` chain or a self-referential `allOf` must not spin forever; parameter
// schemas are shallow, so a small bound is generous.
const MAX_SCHEMA_DEPTH = 12;

function isSchema(value: unknown): value is ThymianSchema {
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
function itemSchema(
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
function propertySchema(
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
function enumMembers(
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

function deserializeArrayItems(
  items: string[],
  schema: ThymianSchema | undefined,
  root: ThymianSchema | undefined,
): unknown[] {
  return items.map((item, index) =>
    deserializeScalar(item, itemSchema(schema, root, index), root),
  );
}

function deserializeObjectEntries(
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
function deserializeItems(
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

/**
 * Query parameters. `items` carries the parameter's scalar wire strings —
 * every occurrence of a repeated key, or the caller's split of a delimited
 * value.
 *
 * `deepObject` is handled by `deserializeDeepObject`, because reconstructing it
 * needs the `name[prop]` keys the caller alone can see.
 */
export function deserializeQueryParameter(
  items: string[],
  schema: ThymianSchema | undefined,
  serializationStyle: SerializationStyle = QUERY_DEFAULT_STYLE,
): DeserializeResult {
  const { style, explode } = serializationStyle ?? QUERY_DEFAULT_STYLE;
  const raw = items.length === 1 ? (items[0] as string) : items;

  // A style describes how a structured value was flattened onto the wire. A
  // scalar has no structure to restore, so an unsupported style costs nothing:
  // the wire value already IS the value, and skipping validation would
  // silently drop `maxLength`/`pattern`/`enum` checks that used to run.
  if (style !== 'form' && isStructural(schema)) {
    return unsupported(serializationStyle);
  }

  return deserializeItems(items, raw, schema, explode);
}

/**
 * Reconstruct an object parameter the caller has already gathered from its
 * constituent query keys — `name[prop]=v` for `deepObject`, or bare `prop=v`
 * keys for `form`/`explode: true`. Both are only defined when exploded.
 */
export function deserializeObjectParameter(
  properties: [string, string | string[]][],
  schema: ThymianSchema | undefined,
  serializationStyle: SerializationStyle = QUERY_DEFAULT_STYLE,
): DeserializeResult {
  const { style, explode } = serializationStyle ?? QUERY_DEFAULT_STYLE;

  if (!explode || (style !== 'deepObject' && style !== 'form')) {
    return unsupported(serializationStyle);
  }

  return deserialized(deserializeObjectEntries(properties, schema, schema));
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
function isStructural(schema: ThymianSchema | undefined): boolean {
  return structuralKind(schema) !== undefined;
}

/**
 * Path parameters and headers, both of which default to `style: simple`.
 * Splitting happens here rather than in the caller because it is
 * schema-directed: only an array- or object-typed parameter is a delimited
 * list. `Date: Mon, 02 Jan 2026` is one string, not three items.
 */
function deserializeSimple(
  raw: string | string[],
  schema: ThymianSchema | undefined,
  style: SerializationStyle | undefined,
  /** Split the single-value form. The caller closes over its own source, so a
   *  path can split the still-ENCODED text while `raw` is already decoded. */
  splitSingle: () => string[],
  /** Split one line of a repeated field value; headers carry no encoding. */
  splitLine: (line: string) => string[] = splitSingle,
): DeserializeResult {
  const serializationStyle = style ?? SIMPLE_DEFAULT_STYLE;

  if (serializationStyle.style !== 'simple') {
    // See deserializeQueryParameter: only a structured value loses meaning
    // under a style we cannot reverse.
    if (isStructural(schema)) {
      return unsupported(serializationStyle);
    }

    return deserializeItems(
      Array.isArray(raw) ? raw : [raw],
      raw,
      schema,
      serializationStyle.explode,
    );
  }

  const structural = isStructural(schema);
  let items: string[];

  if (Array.isArray(raw)) {
    // Repeated field lines. Each line may itself be a list, so a structural
    // schema still splits each one; a scalar schema keeps them whole so the
    // duplicate reaches the schema as the defect it is.
    items = structural ? raw.flatMap((line) => splitLine(line)) : raw;
  } else {
    items = structural ? splitSingle() : [raw];
  }

  return deserializeItems(items, raw, schema, serializationStyle.explode);
}

/**
 * Reverse `serializePathParameter` for one path parameter.
 *
 * The wire forms below are what `url-template` actually produces for the
 * templates that function builds, not a reading of the OpenAPI prose:
 *
 * ```
 *            explode: false          explode: true
 *  label     .3,4,5                  .3.4.5
 *            .role,admin,lvl,3       .role=admin.lvl=3
 *  matrix    ;id=3,4,5               ;id=3;id=4;id=5
 *            ;id=role,admin,lvl,3    ;role=admin;lvl=3
 * ```
 *
 * Array and object are structurally identical under the same style and
 * explode setting (`;id=3;id=4` vs `;role=admin;lvl=3`), so only the declared
 * schema separates them — shape comes from the description, never from
 * guessing at the value.
 *
 * A wire form that does not carry its style's prefix is malformed. It is
 * returned untouched so the schema reports it, rather than being repaired
 * into something that validates.
 */
interface StyledPathValue {
  /** The wire value split into scalar items. */
  items: string[];
  /** The same value with its style packaging removed — the text the client
   *  actually sent, used when the items turn out not to fit the schema. */
  body: string;
}

/**
 * Reverse `serializePathParameter` for one path parameter.
 *
 * The wire forms below are what `url-template` actually produces for the
 * templates that function builds, not a reading of the OpenAPI prose:
 *
 * ```
 *            explode: false          explode: true
 *  label     .3,4,5                  .3.4.5
 *            .role,admin,lvl,3       .role=admin.lvl=3
 *  matrix    ;id=3,4,5               ;id=3;id=4;id=5
 *            ;id=role,admin,lvl,3    ;role=admin;lvl=3
 *  scalars   .5                      ;id=5      (RFC 6570 omits `=` when empty)
 * ```
 *
 * Array and object are structurally identical under the same style and explode
 * setting (`;id=3;id=4` vs `;role=admin;lvl=3`), so only the declared schema
 * separates them — via `structuralKind`, the same accessor the typing step
 * uses, so the two can never disagree.
 *
 * Returns `undefined` when the value is not in its declared style at all. The
 * caller turns that into an assertion failure: the description says how the
 * value must be encoded, and it is not.
 */
function splitStyledPath(
  name: string,
  raw: string,
  schema: ThymianSchema | undefined,
  { style, explode }: SerializationStyle,
  decode: (item: string) => string,
): StyledPathValue | undefined {
  const kind = structuralKind(schema);

  // A scalar is never a delimited list, so `explode` cannot apply and the whole
  // remainder is the value — `.1.5` is the number 1.5, not two items.
  const listDelimiter = (styleDelimiter: string) =>
    kind === undefined ? undefined : explode ? styleDelimiter : ',';

  const split = (body: string, delimiter: string | undefined): string[] =>
    delimiter === undefined
      ? [decode(body)]
      : // An empty body after a present prefix is one empty member, not zero.
        body === ''
        ? ['']
        : splitWireList(body, decode, { delimiter });

  if (style === 'label') {
    if (!raw.startsWith('.')) {
      return undefined;
    }

    const body = raw.slice(1);

    return {
      items: split(body, listDelimiter('.')),
      body: decode(body),
    };
  }

  if (style !== 'matrix') {
    return undefined;
  }

  if (explode && kind !== undefined) {
    // `;id=3;id=4` (array) or `;role=admin;lvl=3` (object).
    if (!raw.startsWith(';')) {
      return undefined;
    }

    const segments = raw.slice(1).split(';');

    if (segments.length === 0 || segments.some((segment) => segment === '')) {
      return undefined;
    }

    if (kind === 'object') {
      const keys = segments.map((segment) => segment.split('=')[0] ?? '');

      // A repeated property is a client defect, not a merge to silently apply.
      if (new Set(keys).size !== keys.length) {
        return undefined;
      }

      return {
        items: segments.map(decode),
        body: segments.map(decode).join(';'),
      };
    }

    // Every member of an exploded array repeats `;name=`.
    if (!segments.every((segment) => segment.startsWith(`${name}=`))) {
      return undefined;
    }

    const items = segments.map((segment) =>
      decode(segment.slice(name.length + 1)),
    );

    return { items, body: items.join(';') };
  }

  // RFC 6570's `;` operator omits `=` entirely when the value is empty, so
  // `;id` is the empty string — the form thymian's own serializer emits.
  if (raw === `;${name}`) {
    return { items: [''], body: '' };
  }

  const prefix = `;${name}=`;

  if (!raw.startsWith(prefix)) {
    return undefined;
  }

  const body = raw.slice(prefix.length);

  // The serializer percent-encodes a literal `;`, so a bare one here is the
  // start of a *different* matrix parameter, never part of this value.
  if (body.includes(';')) {
    return undefined;
  }

  return { items: split(body, listDelimiter(',')), body: decode(body) };
}

export function deserializePathParameter(
  name: string,
  raw: string,
  schema: ThymianSchema | undefined,
  serializationStyle?: SerializationStyle,
  decode: (item: string) => string = (item) => item,
): DeserializeResult {
  const style = serializationStyle ?? SIMPLE_DEFAULT_STYLE;

  if (style.style === 'label' || style.style === 'matrix') {
    const split = splitStyledPath(name, raw, schema, style, decode);

    // The style is reversible and this value is not in it — a description
    // violation, reported as such rather than quietly handed to a schema that
    // may well accept the packaging as a plain string.
    if (!split) {
      return malformed(style);
    }

    // The style prefix is packaging, not part of the value: a `string`-typed
    // `.abc` is `abc`. A value that does not fit its schema is reported as the
    // text the client sent, never as the items it was split into.
    const { items, body } = split;

    return deserializeItems(
      items,
      items.length === 1 ? (items[0] as string) : body,
      schema,
      style.explode,
    );
  }

  return deserializeSimple(decode(raw), schema, style, () =>
    splitWireList(raw, decode),
  );
}

/**
 * Field values RFC 9110 §5.3 exempts from comma-folding: their grammar allows
 * a bare comma, so combining or splitting them on one corrupts the value.
 */
const NON_LIST_HEADERS = new Set(['set-cookie']);

export function deserializeHeaderParameter(
  name: string,
  raw: string | string[] | undefined,
  schema: ThymianSchema | undefined,
  serializationStyle?: SerializationStyle,
): DeserializeResult {
  // An absent header has no wire form to deserialize; pass it through so the
  // schema reports it exactly as it did before.
  if (raw === undefined) {
    return deserialized(undefined);
  }

  const foldable = !NON_LIST_HEADERS.has(name.toLowerCase());

  const split = (value: string) =>
    foldable ? splitHeaderList(value) : [value];

  return deserializeSimple(
    raw,
    schema,
    serializationStyle,
    () => split(Array.isArray(raw) ? raw.join(',') : raw),
    split,
  );
}

/**
 * Split an RFC 9110 §5.6.1 `#rule` list. A comma inside a `quoted-string` is
 * data, not a delimiter — splitting on it turns one `Retry-After` date or
 * `WWW-Authenticate` challenge into several. Optional whitespace is trimmed
 * and empty members are dropped, both as §5.6.1.2 requires.
 */
export function splitHeaderList(raw: string): string[] {
  const items: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of raw) {
    // Quote state only suppresses the DELIMITER. Every character is still
    // appended: members reach the schema exactly as they arrived, so an
    // `items` `pattern`/`enum` written against the wire form of a quoted
    // entity-tag still matches, and `maxLength` counts what was sent.
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (quoted && char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }

    if (char === ',' && !quoted) {
      items.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  // An unbalanced quote means the value is not a well-formed quoted-string, so
  // the quote-awareness was reading the wrong grammar. Fall back to a plain
  // split rather than silently treating every later comma as data.
  if (quoted) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }

  items.push(current);

  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/**
 * Split a still-encoded wire value on a delimiter, then decode each item.
 * Splitting before decoding is what keeps `a%2Cb` one item rather than two.
 * `trim` drops the optional whitespace RFC 9110 §5.6.1 permits in header lists.
 */
export function splitWireList(
  raw: string,
  decode: (item: string) => string,
  {
    trim = false,
    delimiter = ',',
  }: { trim?: boolean; delimiter?: string } = {},
): string[] {
  if (raw === '') {
    return [];
  }

  return raw.split(delimiter).map((item) => decode(trim ? item.trim() : item));
}

/**
 * The message used wherever a parameter's declared style is one thymian cannot
 * deserialize. Reported as `info`, not a failure: the request may well be
 * correct — thymian simply did not check it — and blaming the request for a
 * tool limitation is the very defect this module exists to remove.
 */
export function unsupportedStyleMessage(
  subject: string,
  { style, explode }: UnsupportedSerialization,
): string {
  return `${subject} uses serialization style "${style}" (explode: ${explode}), which thymian cannot deserialize yet — it was not validated against its schema.`;
}

/**
 * The message for a value that is not serialized in the style its description
 * declares. Unlike `unsupportedStyleMessage` this is an assertion failure: the
 * description says how the value must be encoded, and it is not.
 */
export function malformedStyleMessage(
  subject: string,
  { style, explode }: UnsupportedSerialization,
): string {
  return `${subject} is not serialized in its declared style "${style}" (explode: ${explode}).`;
}
