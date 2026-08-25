/**
 * Deterministic TypeScript identifiers for the declarations the generated type
 * surface emits.
 *
 * Every name is a pure function of the transaction's selector plus the schema's
 * role within that transaction. v1 named declarations with a positional counter
 * (`GeneratedSchema1..N`), so inserting one operation renumbered every later
 * declaration. The v2 surface is committed and the diff against it *is* the
 * staleness signal, which makes a positional name a whole-file diff on every
 * insertion.
 *
 * SANITISATION IS NOT COSMETIC, AND THE COLLISION SUFFIX IS NOT DEFENSIVE. A
 * selector legitimately carries characters no identifier can: the method charset
 * is RFC 9110 section 5.6.2 `tchar` (including the backtick), paths carry `/`,
 * `{`, `}` and percent-encoding, and media types carry `/`, `+`, `;`, `=` and
 * spaces. Two distinct selectors therefore collapse onto one stem — a method
 * `A-B` and a method `A.B` on the same path both sanitise to `AB` — so the
 * suffix is reached by real input, not only by paranoia.
 *
 * The suffix order is a function of the selector SET, never of iteration order:
 * candidates are assigned in sorted order of their site key. Adding a
 * transaction that collides with an existing stem can therefore renumber the
 * colliding group (and only that group); adding a non-colliding transaction —
 * the overwhelmingly common case — never renames anything.
 *
 * THE NAME WE REFERENCE AND THE NAME THE LIBRARY DECLARES ARE ONE STRING.
 * `json-schema-to-typescript` does not declare under the name it is handed: it
 * declares under `toSafeString(name)`, which re-cases a lowercase letter that
 * follows a digit (`V1beta` becomes `V1Beta`), collapses `_x` into `X` and
 * upper-cases the first letter. v1 never noticed because `GeneratedSchema1..N`
 * is already a fixed point of that transform; selector-derived names are not,
 * and a name that changes on the way in is a dangling reference on the way out.
 * {@link safeIdentifier} is the single boundary: every name handed to the
 * library goes through it, its output is a fixed point of the library's
 * transform, and {@link NameRegistry} uniquifies AFTER it — so two candidates
 * that sanitise onto one identifier get a suffix instead of one declaration
 * twice.
 *
 * THAT BOUNDARY HAS A SECOND HALF, AND SANITISING ALONE DOES NOT CLOSE IT.
 * The library RE-CASES the name it is handed — which {@link safeIdentifier}
 * settles — but it also IGNORES that name outright when the schema names
 * itself. It resolves a declaration name as
 * `options.customName?.(…) || schema.title || schema.$id || keyNameFromDefinition`
 * (`json-schema-to-typescript@15/dist/src/parser.js:274`), and the normalizer
 * only synthesises the `$id` we rely on `if (!schema.$id && !schema.title …)`
 * (`dist/src/normalizer.js:61-83`). So a schema-level `title` or `$id` outranks
 * BOTH the name `compile()` is handed and the `$defs` key the registry
 * renamed — at the root, at a nested property, and inside `$defs` alike.
 * {@link stripNameKeywordsInPlace} is what closes it: the schema reaches the
 * library carrying no name of its own, so the only name left for it to use is
 * the one this module issued.
 */

/** Which schema of a transaction a declaration was generated for. */
export type SchemaRole =
  | { readonly kind: 'request-body' }
  | { readonly kind: 'response-body' }
  | { readonly kind: 'query-parameter'; readonly parameter: string }
  | { readonly kind: 'path-parameter'; readonly parameter: string }
  | { readonly kind: 'request-header'; readonly parameter: string }
  | { readonly kind: 'cookie'; readonly parameter: string }
  | { readonly kind: 'response-header'; readonly parameter: string };

/**
 * Splits on every run of non-alphanumeric characters and upper-cases each
 * remaining segment's first character, so `GET`, `astronauts`, `{id}` and
 * `application/vnd.Example+JSON` become `Get`, `Astronauts`, `Id` and
 * `ApplicationVndExampleJson`.
 *
 * The tail is lower-cased deliberately: a declaration NAME is not required to be
 * byte-exact (only the emitted key and the union members are), and folding it
 * keeps `JSON` and `json` from producing two visually indistinguishable
 * identifiers.
 */
export function pascalSegments(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map(
      (segment) =>
        `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`,
    )
    .join('');
}

/**
 * A valid identifier fragment for a parameter name. A parameter name may
 * sanitise to nothing at all — `Record` keys of `''` and `'-'` are both
 * reachable — and an empty fragment would silently merge `Header_` with the
 * next one, so the empty case gets a name of its own rather than no name.
 */
export function parameterSegment(name: string): string {
  const segment = pascalSegments(name);

  return segment.length > 0 ? segment : 'Unnamed';
}

/** The role's contribution to a declaration name. */
export function roleSuffix(role: SchemaRole): string {
  switch (role.kind) {
    case 'request-body':
      return 'RequestBody';
    case 'response-body':
      return 'ResponseBody';
    case 'query-parameter':
      return `QueryParam_${parameterSegment(role.parameter)}`;
    case 'path-parameter':
      return `PathParam_${parameterSegment(role.parameter)}`;
    case 'request-header':
      return `Header_${parameterSegment(role.parameter)}`;
    case 'cookie':
      return `Cookie_${parameterSegment(role.parameter)}`;
    case 'response-header':
      return `ResponseHeader_${parameterSegment(role.parameter)}`;
  }
}

/**
 * The identifier a selector plus a role WANTS. Several sites may want the same
 * one; {@link assignUniqueNames} is what turns wants into names.
 *
 * A method is an RFC 9110 `tchar` token, so it may be all digits (`123 /x` is a
 * legal selector), and a parameter name may start with one (`2fa`). Neither an
 * identifier nor the library's own transform tolerates that, so the candidate
 * leaves through {@link safeIdentifier} rather than through a local guard.
 */
export function candidateName(selector: string, role: SchemaRole): string {
  const stem = pascalSegments(selector);

  return safeIdentifier(
    `${stem.length > 0 ? stem : 'Schema'}${roleSuffix(role)}`,
  );
}

const SAFE_CHARACTER = /[A-Za-z0-9_$]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /[0-9]/;
/** A character after which `toSafeString` upper-cases a following lowercase
 * letter: a digit or `$` (`([\d$]+[a-zA-Z])` uppercases the whole match) and an
 * underscore (`_[a-z]` is collapsed into the upper-cased letter). */
const UPPERCASES_WHAT_FOLLOWS = /[0-9$_]/;

/**
 * An identifier that `json-schema-to-typescript`'s `toSafeString` leaves alone,
 * for any input string.
 *
 * The contract is deliberately weaker than "reproduce `toSafeString`": the
 * library never sees the original, only this function's output, so all that has
 * to hold is that the output is a FIXED POINT of the library's transform. That
 * is four conditions, and each one is enforced by a single branch below:
 *
 * - every character is in `[A-Za-z0-9_$]`, so nothing is replaced by whitespace;
 * - the first character is never a digit, hence the `_` prefix;
 * - no lowercase letter follows a digit, a `$` or an `_`;
 * - the first character is never a lowercase letter, so `upperFirst` is a no-op.
 *
 * A run of unusable characters is a word boundary rather than a deletion, so
 * `foo bar` and `foo-bar` both become `FooBar` — the same convention
 * {@link pascalSegments} uses, which is why applying both is harmless.
 */
export function safeIdentifier(value: string): string {
  let result = '';
  let previous = '';
  let atBoundary = true;

  for (const character of value) {
    if (!SAFE_CHARACTER.test(character)) {
      atBoundary = true;
      continue;
    }

    let next = character;

    if (
      LOWERCASE.test(next) &&
      (atBoundary ||
        result.length === 0 ||
        UPPERCASES_WHAT_FOLLOWS.test(previous))
    ) {
      next = next.toUpperCase();
    }

    if (result.length === 0 && DIGIT.test(next)) {
      result = '_';
    }

    result += next;
    previous = next;
    atBoundary = false;
  }

  return result.length > 0 ? result : 'Schema';
}

/**
 * The keywords a schema names ITSELF with, in the library's own precedence
 * order. Both outrank the name `compile()` is handed and the `$defs` key
 * {@link NameRegistry} issued, so both have to be gone before the schema is
 * compiled.
 *
 * Neither carries type information the surface emits: `title` is documentation
 * (`description` is the keyword the library turns into a JSDoc comment, and it
 * is deliberately kept), and `$id` is a base-URI declaration. `plugin-openapi`
 * rewrites every reference it produces to a root-relative `#/$defs/<name>`
 * pointer (`json-schema.processor.ts` `localizeReference`), so no `$ref` on
 * this path resolves against a `$id` base and dropping it cannot move one.
 */
const NAME_KEYWORDS = ['title', '$id'] as const;

/** Keywords whose value is one subschema. */
const SUBSCHEMA_VALUE_KEYWORDS = [
  'additionalProperties',
  'contains',
  'else',
  'if',
  'items',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
] as const;

/** Keywords whose value is an array of subschemas. */
const SUBSCHEMA_ARRAY_KEYWORDS = [
  'allOf',
  'anyOf',
  'oneOf',
  'prefixItems',
] as const;

/**
 * Keywords whose value is a record of subschemas. `definitions` is listed
 * beside `$defs` because `convertDefsToDefinitions` rewrites one into the
 * other, and a schema that already spelled it the draft-07 way names
 * declarations just the same.
 */
const SUBSCHEMA_RECORD_KEYWORDS = [
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
] as const;

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Removes every keyword the library would name a declaration after, everywhere
 * in the tree, so the only name it can declare under is the one this module
 * issued. Mutates the node it is handed; the caller owns the clone.
 *
 * THE WALK IS SCHEMA-POSITION-AWARE, AND THAT IS NOT FASTIDIOUSNESS. A blind
 * "delete every `title` key" walk is wrong twice over, and both cases are
 * ordinary rather than exotic: `properties: { title: … }` is a property CALLED
 * title — a book has one — and deleting that key deletes the property from the
 * emitted type; and `examples`, `const`, `default` and `enum` hold DATA, where
 * a `title` member is a value the example-reflection pass renders into a
 * literal type. Only the positions listed above hold subschemas, so only those
 * are descended into and everything else is left exactly as the description
 * wrote it.
 *
 * Nested `$defs` are descended into even though `plugin-openapi` only hoists to
 * the root, because unlike the naming pass — which has to CHOOSE a name and so
 * is scoped to where names are actually issued (see `schema-definitions.ts`) —
 * this pass only has to REMOVE one, and a nested `$defs` entry with a `title`
 * declares an identifier just as loudly as a root one.
 */
export function stripNameKeywordsInPlace(node: unknown): void {
  if (!isSchemaObject(node)) {
    return;
  }

  for (const keyword of NAME_KEYWORDS) {
    delete node[keyword];
  }

  for (const keyword of SUBSCHEMA_VALUE_KEYWORDS) {
    stripNameKeywordsInPlace(node[keyword]);
  }

  for (const keyword of SUBSCHEMA_ARRAY_KEYWORDS) {
    const branches = node[keyword];

    if (!Array.isArray(branches)) {
      continue;
    }

    for (const branch of branches) {
      stripNameKeywordsInPlace(branch);
    }
  }

  for (const keyword of SUBSCHEMA_RECORD_KEYWORDS) {
    const entries = node[keyword];

    if (!isSchemaObject(entries)) {
      continue;
    }

    for (const entry of Object.values(entries)) {
      stripNameKeywordsInPlace(entry);
    }
  }
}

/** A site asking for a name, identified by a key that is unique and sortable. */
export type NameRequest = {
  readonly key: string;
  readonly candidate: string;
};

/** UTF-16 code-unit comparison — what `<` on two strings does. It is NOT byte
 * order: above the BMP a surrogate pair sorts before U+E000..U+FFFF, which byte
 * order would put first. That difference is irrelevant here (any total order
 * that is a pure function of the strings keeps the output stable) and the
 * property that matters is the one `localeCompare` lacks: no dependence on the
 * machine's locale, hence no dependence on the machine that generated the
 * file. */
export function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/**
 * The one place a declaration name is minted, for every kind of declaration the
 * surface emits: the aliases the surface writes itself, the `$defs` it hoists,
 * the per-site schemas and the example bases.
 *
 * "ONE registry" IS A CLAIM ABOUT THIS CODE, NOT ABOUT THE OUTPUT FILE. Being
 * the only minter does not make it the only SOURCE: a `title` or a `$id` on the
 * schema names a declaration without asking, and the registry cannot suffix
 * against a name it was never shown. What makes the claim true of the emitted
 * file is {@link stripNameKeywordsInPlace} removing the competing source before
 * anything compiles — so a name minted anywhere else is a defect in that pass,
 * not something this class can defend against.
 *
 * ONE registry, because the identifier space is one namespace. A `$defs` entry
 * called `Status` and the `Status` union are the same identifier to `tsc`; so
 * are a `$defs` entry called `PetBase` and the base minted for a `$defs` entry
 * called `Pet`. Anything that mints a name outside this registry can only be
 * checked against the others by the compiler, i.e. after the file is written.
 *
 * `assign` is keyed, not counted: the key identifies the THING being named, so
 * asking twice for the same thing returns the same name. That is what lets a
 * `$defs` entry shared by ten transactions be reflected ten times and still
 * produce one declaration.
 *
 * The `used` set is consulted rather than a per-candidate counter because a
 * suffixed name can itself be somebody's bare candidate: a site wanting `Foo_2`
 * and two sites wanting `Foo` must still end up with three distinct names.
 */
export class NameRegistry {
  private readonly used = new Set<string>();
  private readonly byKey = new Map<string, string>();

  /** Claims names nothing may be assigned. */
  reserve(names: Iterable<string>): void {
    for (const name of names) {
      this.used.add(name);
    }
  }

  /** The name for `key`, minted from `candidate` the first time it is asked
   * for. Sanitisation happens BEFORE the uniqueness check, so two candidates
   * that sanitise onto one identifier are separated rather than merged. */
  assign(key: string, candidate: string): string {
    const existing = this.byKey.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const safe = safeIdentifier(candidate);
    let name = safe;
    let suffix = 1;

    while (this.used.has(name)) {
      suffix += 1;
      name = `${safe}_${suffix}`;
    }

    this.used.add(name);
    this.byKey.set(key, name);

    return name;
  }
}

/** Registry keys are namespaced so a site, a definition and a base can never
 * collide on one key and silently share a name. */
export function siteNameKey(key: string): string {
  return `site\u0000${key}`;
}

/**
 * Resolves every request to a unique identifier, deterministically.
 *
 * Assignment walks the requests in SORTED KEY ORDER — not catalog order — and
 * hands the bare candidate to the first claimant; later claimants get `_2`,
 * `_3`, … That ordering is the whole reason the suffix is a function of the
 * selector set rather than of iteration order, so it is load-bearing rather
 * than tidy.
 */
export function assignUniqueNames(
  requests: Iterable<NameRequest>,
  registry: NameRegistry = new NameRegistry(),
): Map<string, string> {
  const sorted = [...requests].sort((a, b) => compareStrings(a.key, b.key));
  const assigned = new Map<string, string>();

  for (const request of sorted) {
    assigned.set(
      request.key,
      registry.assign(siteNameKey(request.key), request.candidate),
    );
  }

  return assigned;
}
