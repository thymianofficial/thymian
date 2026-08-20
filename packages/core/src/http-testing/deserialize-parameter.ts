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

/** A wire value that could not be deserialized because its style is unsupported. */
export interface UnsupportedSerialization {
  supported: false;
  style: Style;
  explode: boolean;
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
function flattenSchema(
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

    merged.items ??= flat.items;
    merged.prefixItems ??= flat.prefixItems;
    merged.contains ??= flat.contains;
    merged.enum ??= flat.enum;
    merged.const ??= flat.const;
    merged.anyOf ??= flat.anyOf;
    merged.oneOf ??= flat.oneOf;
    merged.additionalProperties ??= flat.additionalProperties;

    if (flat.properties) {
      merged.properties = { ...flat.properties, ...merged.properties };
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
    const matches = members.filter((member) => String(member) === wire);

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

  if (types.includes('array')) {
    return deserialized(deserializeArrayItems(items, schema, schema));
  }

  if (types.includes('object')) {
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

  if (style !== 'form') {
    return unsupported(serializationStyle);
  }

  const raw = items.length === 1 ? (items[0] as string) : items;

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

/** Types that make the wire value a delimited list rather than one scalar. */
function isStructural(schema: ThymianSchema | undefined): boolean {
  const types = schemaTypes(schema, schema);

  // `string` wins: a description that accepts a string accepts the value whole,
  // so it must never be torn apart on a delimiter it legitimately contains.
  return (
    !types.includes('string') &&
    (types.includes('array') || types.includes('object'))
  );
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
  split: (value: string) => string[],
): DeserializeResult {
  const serializationStyle = style ?? SIMPLE_DEFAULT_STYLE;

  if (serializationStyle.style !== 'simple') {
    return unsupported(serializationStyle);
  }

  const structural = isStructural(schema);
  let items: string[];

  if (Array.isArray(raw)) {
    // Repeated field lines. Each line may itself be a list, so a structural
    // schema still splits each one; a scalar schema keeps them whole so the
    // duplicate reaches the schema as the defect it is.
    items = structural ? raw.flatMap((line) => split(line)) : raw;
  } else {
    items = structural ? split(raw) : [raw];
  }

  return deserializeItems(items, raw, schema, serializationStyle.explode);
}

export function deserializePathParameter(
  raw: string,
  schema: ThymianSchema | undefined,
  serializationStyle?: SerializationStyle,
  decode: (item: string) => string = (item) => item,
): DeserializeResult {
  return deserializeSimple(decode(raw), schema, serializationStyle, () =>
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

  return deserializeSimple(raw, schema, serializationStyle, (value) =>
    foldable ? splitHeaderList(value) : [value],
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
    if (escaped) {
      current += char;
      escaped = false;
    } else if (quoted && char === '\\') {
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
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
  { trim = false }: { trim?: boolean } = {},
): string[] {
  if (raw === '') {
    return [];
  }

  return raw.split(',').map((item) => decode(trim ? item.trim() : item));
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
