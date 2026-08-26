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
 * (`dist/src/normalizer.js:61-83`). So a schema-level `title`, `$id` or `id`
 * outranks BOTH the name `compile()` is handed and the `$defs` key the registry
 * renamed — at the root, at a nested property, and inside `$defs` alike.
 * {@link stripNameKeywordsInPlace} is what closes it: the schema reaches the
 * library carrying no name of its own, so the only name left for it to use is
 * the one this module issued.
 *
 * A DESCRIPTION MUST NOT BE ABLE TO WRITE TYPESCRIPT EITHER, which is a second
 * hazard through the same door and is closed at a different point in the
 * pipeline — see {@link stripTypeDirectivesInPlace}.
 *
 * ENUMERATING KEYWORDS IS NOT A PROOF, AND THIS BOUNDARY HAS NOW BEEN CLOSED
 * THREE TIMES BY ENUMERATION. `title`, then `$id`, then `id` — each round found
 * the same failure through a keyword the previous round's list did not contain,
 * and the worst case was silent every time (a `tsc`-clean surface in which one
 * declaration carries another schema's body). The strip below is still the FIX;
 * what makes the class closed rather than merely narrower is `emitted-names.ts`,
 * which asserts after every `compile()` that every identifier in the output is
 * one the library was ENTITLED to mint. A keyword this list forgets is then a
 * loud abort instead of a corrupt commit.
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
 * order. All three outrank the name `compile()` is handed and the `$defs` key
 * {@link NameRegistry} issued, so all three have to be gone before the schema is
 * compiled.
 *
 * None of them carries type information the surface emits: `title` is
 * documentation (`description` is the keyword the library turns into a JSDoc
 * comment, and it is deliberately KEPT here — AC8 requires that comment), and
 * `$id`/`id` are base-URI declarations. `plugin-openapi` rewrites every
 * reference it produces to a root-relative `#/$defs/<name>` pointer
 * (`json-schema.processor.ts` `localizeReference`), so no `$ref` on this path
 * resolves against a `$id` base and dropping it cannot move one.
 *
 * `id` IS NOT COVERED BY REMOVING `$id`, AND IT IS THE SAME BOUNDARY A THIRD
 * TIME. The library's normalizer runs `rules.set('Transform id to $id', …)` at
 * `json-schema-to-typescript@15.0.4/dist/src/normalizer.js:49`, which copies a
 * draft-04 `id` onto `$id` AFTER this pass has already run — so `id` walks back
 * in through the very keyword `$id` was removed to protect, and the rule that
 * would otherwise synthesise OUR name is the next one in the same file (`:61`,
 * `'Add an $id to anything that needs it'`, which fires only
 * `if (!schema.$id && !schema.title …)`). `plugin-openapi` copies it through by
 * the identical mechanism as `title` and `$id`: `keysToRemove`
 * (`json-schema.processor.ts:6-14`) lists seven keys and `id` is not among them,
 * and the fall-through at `:183` is `result[key] = structuredClone(value)`. `id`
 * is the draft-04 spelling of `$id`, so it is ordinary in any
 * `components/schemas` entry carried over from a draft-04 JSON Schema.
 */
const NAME_KEYWORDS = ['title', '$id', 'id'] as const;

/**
 * The library's OWN schema extensions — the only two it declares
 * (`json-schema-to-typescript@15.0.4/dist/src/types/JSONSchema.d.ts`:
 * `tsEnumNames?: string[]` and `tsType?: string`). They reach here by exactly
 * the same `plugin-openapi` fall-through as `title`/`$id`/`id`, and they are
 * removed by the same walk — but NOT at the same boundary and NOT for the same
 * reason, so they are a list of their own rather than three more
 * {@link NAME_KEYWORDS}. See {@link stripTypeDirectivesInPlace} for why the
 * boundary differs; the reasons they must go at all:
 *
 * - `tsType` is "an escape hatch that supercedes all other directives"
 *   (`dist/src/typesOfSchema.js:15-16`). It does not merely rename a
 *   declaration, it DICTATES the emitted type: a property schema
 *   `{type: 'string', tsType: 'SomethingUndeclared'}` emits
 *   `a?: SomethingUndeclared` verbatim into the committed `.d.ts` (TS2304), a
 *   `tsType` naming a REAL declaration silently retypes a body with no
 *   diagnostic at all, and a root-level one emits
 *   `export type <Name> = SomethingUndeclared`. A description must not be able
 *   to write TypeScript into the surface.
 * - `tsEnumNames` reaches the library's `NAMED_ENUM` branch, whose
 *   `standaloneName` falls back to the PROPERTY KEY (`dist/src/parser.js:121`),
 *   so `{kind: {type: 'string', enum: ['a'], tsEnumNames: ['Hijack']}}` mints
 *   `export const enum Kind { Hijack = "a" }` — an identifier nothing reserved,
 *   and a `const enum` inside a `.d.ts`.
 *
 * Stripping `tsEnumNames` leaves `enum` rendering as the closed literal union
 * AC6 requires ("`enum`/`const` are left as-is (already closed unions)"), so
 * this narrows nothing the surface promised.
 */
export const TYPE_DIRECTIVE_KEYWORDS = ['tsType', 'tsEnumNames'] as const;

/**
 * Documentation that a name must not depend on. Stripped only by
 * {@link stripIdentityNoiseInPlace}, never by {@link stripNameKeywordsInPlace}:
 * `description` is the one keyword the library turns into a JSDoc comment, and
 * AC8 requires that comment to survive into the emitted surface.
 */
const DESCRIPTION_KEYWORDS = ['description'] as const;

/**
 * Keywords whose value is one subschema.
 *
 * `items` appears here and is ALSO reached in its array (tuple) form, because
 * `parse` descends every element of an array-valued `items` through the `TUPLE`
 * branch (`dist/src/parser.js:190-200`). `additionalItems` is the same branch's
 * single-subschema companion. Neither is reachable through `plugin-openapi`
 * today — it mangles array-form `items` into an object and `ThymianSchema.items`
 * is a single schema — but "the type does not declare it" is not evidence about
 * the value, which is the mistake this list was built from the first time. The
 * list is now derived from what THE LIBRARY PARSES, which is the property that
 * decides whether a declaration can be minted. Both are safe to strip: an
 * unnamed tuple element and an unnamed `additionalItems` are simply inlined
 * (verified), unlike `extends` — see {@link SUBSCHEMA_ARRAY_KEYWORDS}.
 */
const SUBSCHEMA_VALUE_KEYWORDS = [
  'additionalItems',
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

/**
 * Keywords whose value is an array of subschemas.
 *
 * `extends` IS DELIBERATELY ABSENT, AND THAT IS A MEASURED DECISION RATHER THAN
 * AN OVERSIGHT — it was in this list, and removing the name from a super-type
 * turned out to break the library outright. Draft-03 `extends` is walked by
 * `parseSuperTypes` (`dist/src/parser.js:293-301`), so a `title` inside one does
 * declare an extra interface exactly like a `title` inside `allOf` does. But a
 * super-type with NO name renders as `export interface X extends  {` — an empty
 * `extends` clause — and the library's own formatter throws a raw prettier
 * `SyntaxError: ']' expected`. That is pre-existing behaviour for an untitled
 * `extends` (verified against the unmodified library), so stripping here would
 * not fix a hole, it would only convert "compiles under a hijacked name" into
 * "aborts with an opaque error from inside a dependency", for descriptions that
 * work today.
 *
 * The naming hazard is covered instead, and better, by `emitted-names.ts`: an
 * identifier minted from a `title`/`$id`/`id` inside `extends` is not in the
 * entitled set, so it aborts with a named `GeneratedNameEscapeError` that says
 * what happened. And the type directives cannot be smuggled in this way either:
 * `extends: [{tsType: 'Evil'}]` also yields an unnamed super-type and the same
 * pre-existing `SyntaxError`, so there is nothing to inject through. Verified
 * both ways.
 */
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
 * ONE walk, three keyword sets. A second copy of the position list is exactly
 * the drift this whole class of defect is made of — the list has been wrong
 * three times, and each time it was wrong in one copy — so the callers differ
 * only in WHAT they delete, never in WHERE they look.
 *
 * THE WALK IS SCHEMA-POSITION-AWARE, AND THAT IS NOT FASTIDIOUSNESS. A blind
 * "delete every `title` key" walk is wrong twice over, and both cases are
 * ordinary rather than exotic: `properties: { title: … }` is a property CALLED
 * title — a book has one — and deleting that key deletes the property from the
 * emitted type; and `examples`, `const`, `default` and `enum` hold DATA, where a
 * `title`, an `id` or a `description` member is a value the example-reflection
 * pass renders into a literal type. Only the positions listed above hold
 * subschemas, so only those are descended into and everything else is left
 * exactly as the description wrote it.
 *
 * Nested `$defs` are descended into even though `plugin-openapi` only hoists to
 * the root, because unlike the naming pass — which has to CHOOSE a name and so
 * is scoped to where names are actually issued (see `schema-definitions.ts`) —
 * this pass only has to REMOVE one, and a nested `$defs` entry with a `title`
 * declares an identifier just as loudly as a root one.
 */
/**
 * ONE walk over every position the library parses a subschema in, exposed as a
 * visitor so that the position list has exactly one copy. A second copy of this
 * list is exactly the drift this whole class of defect is made of — the list has
 * been wrong three times, and each time it was wrong in one copy — so every
 * caller differs only in WHAT it does at a node, never in WHERE it looks.
 *
 * Nested `$defs` are descended into even though `plugin-openapi` only hoists to
 * the root, because unlike the naming pass — which has to CHOOSE a name and so
 * is scoped to where names are actually issued (see `schema-definitions.ts`) —
 * a pass that only READS or REMOVES a name is safe to run everywhere.
 *
 * `extends` is deliberately absent; see {@link SUBSCHEMA_ARRAY_KEYWORDS}.
 *
 * A visitor returning `false` PRUNES the subtree below that node. That exists
 * for one measured reason: `tsType` "supercedes all other directives"
 * (`typesOfSchema.js:15-16`), so the library emits it verbatim and never parses
 * anything beneath it — verified, a `$ref` nested under a `tsType` node produces
 * no declaration at all. A caller asking "what did the library compile?" has to
 * stop where the library stopped.
 */
export function walkSubschemaNodes(
  node: unknown,
  visit: (schema: Record<string, unknown>) => boolean | void,
): void {
  if (!isSchemaObject(node)) {
    return;
  }

  if (visit(node) === false) {
    return;
  }

  for (const keyword of SUBSCHEMA_VALUE_KEYWORDS) {
    const value = node[keyword];

    // A single-subschema keyword whose value happens to be an ARRAY is the
    // tuple form, and every element is a subschema of its own. Handling it here
    // rather than as a special case for `items` is what keeps the position list
    // one list.
    if (Array.isArray(value)) {
      for (const item of value) {
        walkSubschemaNodes(item, visit);
      }

      continue;
    }

    walkSubschemaNodes(value, visit);
  }

  for (const keyword of SUBSCHEMA_ARRAY_KEYWORDS) {
    const branches = node[keyword];

    if (!Array.isArray(branches)) {
      continue;
    }

    for (const branch of branches) {
      walkSubschemaNodes(branch, visit);
    }
  }

  for (const keyword of SUBSCHEMA_RECORD_KEYWORDS) {
    const entries = node[keyword];

    if (!isSchemaObject(entries)) {
      continue;
    }

    for (const entry of Object.values(entries)) {
      walkSubschemaNodes(entry, visit);
    }
  }
}

function stripKeywordsInPlace(
  node: unknown,
  keywords: readonly string[],
): void {
  walkSubschemaNodes(node, (schema) => {
    for (const keyword of keywords) {
      delete schema[keyword];
    }
  });
}

const IDENTITY_NOISE_KEYWORDS: readonly string[] = [
  ...NAME_KEYWORDS,
  ...TYPE_DIRECTIVE_KEYWORDS,
  ...DESCRIPTION_KEYWORDS,
];

/**
 * Removes every keyword the library would name a declaration after, everywhere
 * in the tree, so the only name it can declare under is the one this module
 * issued. Mutates the node it is handed; the caller owns the clone.
 *
 * Called at the single `compile()` boundary
 * (`src/hooks/generate-request-types.ts`), so it runs over every schema the
 * surface compiles — sites, example bases and the frozen v1 path alike.
 *
 * IT DELIBERATELY DOES NOT REMOVE THE TYPE DIRECTIVES, and that is the one place
 * "strip everything untrusted at the compile boundary" is the wrong shape.
 * `example-reflection.ts` WRITES `tsType` itself (`:241`, `:272`) — that is
 * AC6's whole mechanism — and it writes it BEFORE this boundary is reached
 * (`generate-request-types-surface.ts` clones, reflects, then compiles). A
 * `tsType` strip here deletes the generator's own output: verified, it fails
 * eight example-reflection tests. {@link stripTypeDirectivesInPlace} is the
 * separate pass, at the separate boundary, that handles the description's
 * directives.
 *
 * `description` is deliberately NOT removed either: it is the keyword the
 * library turns into a JSDoc comment, and AC8 wants that comment in the surface.
 */
/**
 * Rewrites every `extends` into an equivalent `allOf`, everywhere in the tree.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A STRIP. `extends` is the one position the
 * library PARSES as a subschema that {@link walkSubschemaNodes} does not enter,
 * so a `title` there declared an interface nothing reserved. Round 4 left it and
 * let the postcondition abort. That was the wrong trade: measured, a named
 * super-type compiles CORRECTLY today (`interface Root extends Owner` plus a
 * well-formed `Owner`), so the abort broke a working description — where rounds
 * 1-3 each replaced a silently WRONG file with a loud failure.
 *
 * Deleting `extends` was tested and rejected: it drops the super-type's members
 * from the emitted type with no diagnostic, which trades a working file for
 * silent data loss.
 *
 * Folding is what survived. Draft-03 `extends` and `allOf` express the same
 * thing, `allOf` IS in the walk, so the name is stripped like any other, and the
 * members are preserved — verified end to end. Run BEFORE the name strip, so the
 * super-type's `title` is removed as part of the `allOf` it now sits in.
 *
 * A non-schema `extends` is left exactly as it was: this pass normalises a
 * position it understands and never invents an interpretation for one it does
 * not.
 */
export function foldExtendsInPlace(node: unknown): void {
  walkSubschemaNodes(node, (schema) => {
    const superTypes = schema['extends'];
    const folded = Array.isArray(superTypes)
      ? superTypes.filter((entry) => isSchemaObject(entry))
      : isSchemaObject(superTypes)
        ? [superTypes]
        : undefined;

    if (folded === undefined || folded.length === 0) {
      return;
    }

    const existing = schema['allOf'];

    schema['allOf'] = Array.isArray(existing)
      ? [...folded, ...existing]
      : folded;
    delete schema['extends'];
  });
}

export function stripNameKeywordsInPlace(node: unknown): void {
  stripKeywordsInPlace(node, NAME_KEYWORDS);
}

/**
 * Removes the library's own schema extensions ({@link TYPE_DIRECTIVE_KEYWORDS})
 * from every schema position, so a DESCRIPTION cannot use them.
 *
 * THE BOUNDARY IS "WHERE THE DESCRIPTION ENTERS", NOT "WHERE COMPILATION
 * HAPPENS", and the two are not the same point. `tsType` is not only an
 * untrusted input, it is also the generator's own trusted output: AC6's example
 * reflection sets it on the cloned schema and relies on `compile()` emitting it
 * verbatim. So the strip has to run while the schema is still purely the
 * description's — `generate-request-types-surface.ts`, on the fresh
 * `structuredClone(site.schema)`, BEFORE `applyDefinitionNames` and
 * `reflectExamplesInPlace`. Everything the reflection pass writes afterwards is
 * ours and survives.
 *
 * THE V1 PATH IS DELIBERATELY NOT COVERED, and that is not an oversight. v1's
 * `generateTypesForThymianFormat` calls `generateTypeForSchema` directly, so the
 * only place a strip could sit for it is the compile boundary — which is exactly
 * where it would destroy reflection for v2. v1's output is a regenerated scratch
 * artifact nothing type-checks, and AC10 freezes it byte for byte; a
 * description-borne `tsEnumNames` still aborts v1 loudly via
 * `emitted-names.ts`'s postcondition, because it mints an unentitled identifier.
 * A description-borne `tsType` mints no name and so passes through v1 — recorded
 * here as a known limit of the frozen path rather than fixed by unfreezing it.
 */
export function stripTypeDirectivesInPlace(node: unknown): void {
  stripKeywordsInPlace(node, TYPE_DIRECTIVE_KEYWORDS);
}

/**
 * The same walk over name keywords, type directives AND `description`, for the
 * one caller that needs a schema's IDENTITY rather than a compilable schema:
 * `schema-definitions.ts` keys `$defs` disambiguation on canonicalized content,
 * and keying that on documentation splits one shared definition into two the
 * moment a description is edited.
 *
 * This is NOT a strip applied on the compile path — the compiled body keeps its
 * `description` and therefore its JSDoc. It exists so that "same emitted type"
 * and "same identity" are the same question.
 */
export function stripIdentityNoiseInPlace(node: unknown): void {
  stripKeywordsInPlace(node, IDENTITY_NOISE_KEYWORDS);
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
