import { ThymianBaseError } from '@thymian/core';

import {
  compareStrings,
  type NameRegistry,
  safeIdentifier,
  stripIdentityNoiseInPlace,
  stripTypeDirectivesInPlace,
} from './type-names.js';

/**
 * `$defs` bookkeeping for the generated type surface.
 *
 * `json-schema-to-typescript` names a nested declaration after the `$defs` key
 * it came from, and `plugin-openapi` hoists every `components/schemas` entry to
 * the schema root as a `$defs` entry with a local `#/$defs/<name>` pointer
 * (`json-schema.processor.ts:70-81`, `:200`). Two transactions that share a
 * schema therefore compile to the same nested declaration — which is exactly
 * what the surface wants, since it is emitted once and referenced twice — while
 * two transactions whose descriptions happen to agree on a NAME but not on its
 * CONTENT compile to one identifier with two different bodies. Both cases are
 * diagnostics in the emitted `.d.ts`: identical interfaces still collide on
 * their `[k: string]: unknown` index signature (TS2374, and `additionalProperties: true`
 * is load-bearing for the v1 test suite), and a duplicated type alias is TS2300.
 *
 * The fix is to make the NAME a function of the CONTENT before compiling, never
 * of the site: the same content keeps one name everywhere (so the declaration
 * dedupes), and divergent content under one name is separated (so it compiles).
 *
 * Only ROOT-level `$defs` are considered, because that is the only place
 * `plugin-openapi` puts them.
 *
 * `$defs` IS NOT THE ONLY KEYWORD THAT CAN NAME A NESTED DECLARATION, and this
 * docblock used to claim it was, on the grounds that `ThymianSchema` carries no
 * `title`. That reasoned from the TypeScript TYPE to the runtime VALUE across a
 * package boundary, and the producer is under no obligation to agree with a type
 * it does not import: `plugin-openapi` copies unknown keywords through verbatim
 * (`json-schema.processor.ts`, `keysToRemove` lists seven keys and none of
 * `title`, `$id` or `id` is among them), so all three arrive here however absent
 * they are from the type. They outrank everything this module assigns — see
 * `type-names.ts`, "THAT BOUNDARY HAS A SECOND HALF" — and are removed by
 * `stripNameKeywordsInPlace` before anything is compiled, with
 * `emitted-names.ts` asserting afterwards that nothing named itself anyway. A
 * statement about a type is not evidence about a value.
 *
 * THREE THINGS THE NAME IS KEYED ON, AND ONE IT IS NOT. It is keyed on the
 * EMITTED IDENTIFIER, not on the raw `$defs` key: `pet-owner` and `pet_owner`
 * are two keys but one identifier, so leaving them unsuffixed emits one
 * interface twice. It is keyed on the content, so the same content keeps one
 * name everywhere. And it is assigned through the SHARED registry, so a
 * generated `_2` cannot land on a name that already exists — either another
 * definition's, a site's, or one of the surface's own aliases (`Status` and
 * `Selector` are perfectly ordinary `components/schemas` names). It is NOT
 * keyed on position: a digit-leading key like `400` is a legal
 * `components/schemas` name and becomes `_400` rather than an empty identifier
 * that makes the library's formatter throw a raw `SyntaxError`.
 *
 * The bare name goes to the content that appears FIRST, in catalog order, not
 * to the one that sorts first by content. Content order made an incumbent's
 * name depend on what was added later — adding an unrelated transaction whose
 * same-named definition happened to sort earlier demoted the incumbent to `_2`
 * and flipped every alias pointing at it. Appending is the common case and it
 * now renames nothing. Inserting a transaction AHEAD of the incumbent still
 * can, which is the same "renumbers the colliding group, and only that group"
 * property `type-names.ts:20-24` states for site names. The SAME rule decides
 * the representative BODY: first seen, in catalog/site order, wins.
 *
 * IDENTITY IS THE STRIPPED SUBTREE, NOT THE RAW ONE, BECAUSE A COMMENT MUST NOT
 * BE STRUCTURE. Keyed on the raw definition, `title` and `description` are part
 * of a definition's identity — so two transactions sharing one `$defs.Pet` with
 * byte-identical structure emit ONE `interface Pet` when the documentation
 * matches and `Pet` PLUS `Pet_2`, with identical bodies, when only the
 * `description` differs (verified both ways). AC8's premise is that the drift
 * comparison strips comments and JSDoc precisely so a documentation-only spec
 * edit is a NON-EVENT; a new `_2` declaration plus a flipped alias is a
 * structural diff that survives comment-stripping. {@link definitionIdentity}
 * removes the naming keywords, the library's type directives and `description`
 * at every schema position before canonicalizing, so identity answers "is this
 * the same emitted TYPE?" and nothing else.
 *
 * STRIPPING IDENTITY ALONE IS NOT THE FIX, AND SHIPPING IT ALONE WOULD BE WORSE
 * THAN THE BUG. Give two differently-documented definitions one name while each
 * still compiles its OWN body and the surface emits two `export interface Pet`
 * blocks that differ only in JSDoc — `DeclarationSet` de-duplicates on TEXT, so
 * it keeps both, and a duplicate identifier is a hard `tsc` error where the `_2`
 * merely compiled. Measured, not assumed: two `Pet` declarations, one per
 * description. So the name and the BODY move together —
 * {@link assignDefinitionNames} records a REPRESENTATIVE body per (identifier,
 * identity) pair and {@link applyDefinitionNames} substitutes it. Because
 * identity covers the whole subtree, two bodies with equal identity differ ONLY
 * in documentation somewhere inside it, so the substitution is neutral for the
 * emitted TYPE and changes only which JSDoc is carried.
 *
 * THE PROPERTY THIS BUYS, which is what AC8 asked for: two transactions sharing
 * a `$defs` entry that differ only in `title` or only in `description` emit ONE
 * declaration; editing the NON-representative occurrence's description leaves
 * the emitted surface BYTE-IDENTICAL; editing the representative's changes only
 * the JSDoc, which is a comment-level diff the drift comparison strips.
 *
 * KNOWN LIMIT, deliberately not solved here: the disambiguation is keyed on a
 * definition's own content, not on the transitive closure of its `$ref`s. Two
 * descriptions that agree on `Owner` but disagree on the `Pet` it points at
 * would rewrite one `Owner` to reference `Pet_2` while the other keeps `Pet`,
 * giving one identifier two bodies again. Reaching that needs two descriptions
 * loaded together with cross-referencing same-named-different-content schemas;
 * a Merkle-style content name would close it and is out of this story's scope.
 */

/** Canonical JSON: object keys in byte order, so equal content is equal text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

  return `{${entries.join(',')}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The keyword a schema's ROOT definitions live under. A draft-07 description
 * writes `definitions`; 2020-12 writes `$defs`. Reading only `$defs` meant a
 * draft-07 block skipped naming, identity and de-duplication entirely, so two
 * transactions with divergent `definitions.Pet` emitted two `interface Pet`
 * bodies. `convertDefsToDefinitions` refuses a schema carrying both, so there is
 * always at most one to find.
 */
function rootDefinitionsKeyOf(
  schema: unknown,
): '$defs' | 'definitions' | undefined {
  if (!isPlainObject(schema)) {
    return undefined;
  }

  if (isPlainObject(schema['$defs'])) {
    return '$defs';
  }

  return isPlainObject(schema['definitions']) ? 'definitions' : undefined;
}

function rootDefinitionsOf(schema: unknown): Record<string, unknown> {
  const key = rootDefinitionsKeyOf(schema);

  return key === undefined
    ? {}
    : ((schema as Record<string, unknown>)[key] as Record<string, unknown>);
}

/**
 * A definition's IDENTITY: canonical JSON over a clone with every naming
 * keyword, every library type directive and `description` removed at every
 * schema position. Two definitions share an identity exactly when they compile
 * to the same TYPE, whatever their documentation says.
 *
 * The strip is `type-names.ts`'s single position-aware walk rather than a second
 * copy of the keyword list here, which is the whole reason that walk takes its
 * keywords as a parameter.
 */
export function definitionIdentity(definition: unknown): string {
  const stripped: unknown = structuredClone(definition);

  stripIdentityNoiseInPlace(stripped);

  return canonicalJson(stripped);
}

/** The name one identity is emitted under, plus the body it is emitted AS. */
export type AssignedDefinition = {
  readonly name: string;
  readonly definition: unknown;
};

/**
 * A two-level lookup: emitted identifier, then identity, yielding the name that
 * identity will be emitted under and the representative body it will be emitted
 * as. Built over every schema the surface will compile, so the assignment is
 * global.
 */
export type DefinitionNameAssignment = ReadonlyMap<
  string,
  ReadonlyMap<string, AssignedDefinition>
>;

/** A registry key for one (identifier, identity) pair. */
function definitionKey(identifier: string, identity: string): string {
  return `$defs\u0000${identifier}\u0000${identity}`;
}

/** `$defs` in sorted key order, so a semantically neutral reordering of
 * `components/schemas` cannot change which content keeps the bare name — two
 * keys of one schema that sanitise onto one identifier are the case that
 * depends on it. */
function sortedDefinitions(schema: unknown): (readonly [string, unknown])[] {
  return Object.entries(rootDefinitionsOf(schema)).sort(([a], [b]) =>
    compareStrings(a, b),
  );
}

/**
 * Assigns one emitted name — and one representative body — per (emitted
 * identifier, distinct identity) pair, through the shared registry so the result
 * cannot collide with anything else the surface declares.
 *
 * The representative is the FIRST definition seen for that pair, in the existing
 * catalog/site order, which is the same rule that decides which content keeps
 * the bare name.
 */
export function assignDefinitionNames(
  schemas: Iterable<unknown>,
  registry: NameRegistry,
): DefinitionNameAssignment {
  const assignment = new Map<string, Map<string, AssignedDefinition>>();

  for (const schema of schemas) {
    for (const [name, definition] of sortedDefinitions(schema)) {
      const identifier = safeIdentifier(name);
      const identity = definitionIdentity(definition);
      const perIdentity =
        assignment.get(identifier) ?? new Map<string, AssignedDefinition>();

      assignment.set(identifier, perIdentity);

      if (!perIdentity.has(identity)) {
        perIdentity.set(identity, {
          name: registry.assign(
            definitionKey(identifier, identity),
            identifier,
          ),
          definition,
        });
      }
    }
  }

  return assignment;
}

/** JSON Pointer escaping, then the URI layer above it. */
function decodePointerToken(token: string): string {
  const unescaped = token.replaceAll('~1', '/').replaceAll('~0', '~');

  try {
    return decodeURIComponent(unescaped);
  } catch {
    return unescaped;
  }
}

function encodePointerToken(token: string): string {
  return token.replaceAll('~', '~0').replaceAll('/', '~1');
}

const DEFINITION_POINTER = /^#\/(\$defs|definitions)\/(.*)$/;

/**
 * Re-points a `$ref` at a renamed definition.
 *
 * IT COMPARES DECODED TOKENS, NOT RAW TEXT, and that is a fix rather than a
 * refinement. A `$defs` key really can contain `/` or `~`, and it is then
 * referenced through an ESCAPED pointer — `#/$defs/pet~1owner` for the key
 * `pet/owner`. Comparing the raw key against the pointer text never matched, so
 * the rename landed on the key and left the pointer dangling, and generation
 * aborted with a raw `MissingPointerError` out of the dependency on input that
 * was perfectly valid. Both spellings are accepted for the same reason
 * `rootDefinitionsOf` reads both.
 */
function rewriteRef(
  value: string,
  renames: ReadonlyMap<string, string>,
): string {
  const match = DEFINITION_POINTER.exec(value);

  if (match === null) {
    return value;
  }

  const keyword = match[1] ?? '$defs';
  const remainder = match[2] ?? '';
  const slash = remainder.indexOf('/');
  const head = slash === -1 ? remainder : remainder.slice(0, slash);
  const tail = slash === -1 ? '' : remainder.slice(slash);
  const to = renames.get(decodePointerToken(head));

  return to === undefined
    ? value
    : `#/${keyword}/${encodePointerToken(to)}${tail}`;
}

function rewriteRefsInPlace(
  node: unknown,
  renames: ReadonlyMap<string, string>,
): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      rewriteRefsInPlace(item, renames);
    }

    return;
  }

  if (!isPlainObject(node)) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      node[key] = rewriteRef(value, renames);
      continue;
    }

    rewriteRefsInPlace(value, renames);
  }
}

/**
 * Renames a schema's root `$defs` keys — and every `#/$defs/` pointer that
 * targets them, wherever it sits in the tree — to the globally assigned names,
 * and substitutes the representative body for each. Mutates the clone it is
 * handed; the caller owns the clone.
 *
 * The substituted body is itself cloned, because the representative is a live
 * node inside the ORIGINAL format — `assignDefinitionNames` runs over the
 * schemas, not over copies of them — and `rewriteRefsInPlace` two lines below
 * would otherwise mutate it on every caller's behalf. Its `$ref` strings are
 * byte-identical to the ones it replaces (identity covers the whole subtree), so
 * the rewrite that follows is the same rewrite either way.
 *
 * Key ORDER is left exactly as the description had it. Ordering is normalised
 * in the one place it can be observed — `reflectExamplesInPlace`, where the
 * order entries are visited in decides what later ones see — and normalising it
 * twice would leave one of the two sorts unfalsifiable.
 */
export function applyDefinitionNames(
  schema: unknown,
  assignment: DefinitionNameAssignment,
): void {
  if (!isPlainObject(schema)) {
    return;
  }

  const definitionsKey = rootDefinitionsKeyOf(schema);

  if (definitionsKey === undefined) {
    return;
  }

  const defs = schema[definitionsKey] as Record<string, unknown>;

  const renames = new Map<string, string>();
  const renamed = new Map<string, unknown>();

  for (const [name, definition] of Object.entries(defs)) {
    const identity = definitionIdentity(definition);
    const assigned = assignment.get(safeIdentifier(name))?.get(identity);
    const assignedName = assigned?.name ?? safeIdentifier(name);
    // The representative is captured off the UNTOUCHED format, so it has not
    // been through the site clone's `stripTypeDirectivesInPlace`. Substituting
    // it raw put `tsType` back into a schema the strip had already cleaned —
    // silently, because `tsType` mints no identifier for the postcondition to
    // catch — and `definitionIdentity` ignores the directives, so a clean
    // definition in one transaction was emitted from a poisoned representative
    // in another. Strip at the substitution, which is where the untrusted node
    // re-enters.
    const body: unknown =
      assigned === undefined
        ? definition
        : structuredClone(assigned.definition);

    if (assigned !== undefined) {
      stripTypeDirectivesInPlace(body);
    }

    if (assignedName !== name) {
      renames.set(name, assignedName);
    }

    const occupant = renamed.get(assignedName);

    // Unreachable by construction — the registry hands out one name per
    // (identifier, identity) pair and never repeats one — so it is a hard abort
    // rather than a silent last-write-wins. The failure it replaces was the
    // worst kind: one definition dropped, another retyped, and `tsc` reporting
    // a clean surface because the emitted file was perfectly consistent with
    // itself and wrong.
    //
    // The comparison is on IDENTITY, not on raw canonical JSON, for the same
    // reason the assignment is: a documentation-only difference must not read as
    // a collision, or this aborts on input the rest of the module deliberately
    // merges.
    if (occupant !== undefined && definitionIdentity(occupant) !== identity) {
      throw new ThymianBaseError(
        `Two schema definitions would both be emitted as "${assignedName}" with different content.`,
        {
          name: 'DefinitionNameCollisionError',
          suggestions: [
            'This is a defect in the generated type surface, not in the API description.',
            'Please report it, with the description that triggered it.',
          ],
        },
      );
    }

    renamed.set(assignedName, body);
  }

  schema[definitionsKey] = Object.fromEntries(renamed);

  if (renames.size > 0) {
    rewriteRefsInPlace(schema, renames);
  }
}
