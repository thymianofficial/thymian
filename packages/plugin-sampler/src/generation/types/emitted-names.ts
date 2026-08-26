import { ThymianBaseError } from '@thymian/core';
import {
  justName,
  toSafeString,
} from 'json-schema-to-typescript/dist/src/utils.js';

import { identifierOf, splitDeclarations } from './declaration-set.js';

/**
 * The runtime postcondition on `compile()`: every identifier the library
 * declared is one it was ENTITLED to declare.
 *
 * WHY A POSTCONDITION AND NOT ANOTHER KEYWORD. `type-names.ts` strips the
 * keywords a schema can name itself with, and that list has now been wrong three
 * times — `title`, then `$id`, then `id` — each time found by the same probe,
 * each time silent in the worst case. Enumerating what the library MIGHT do
 * cannot close a class; checking what it ACTUALLY did can. This module is that
 * check, and it is deliberately written against the library's own naming
 * functions rather than against a reimplementation of them, so a version bump
 * that changes `toSafeString` or `justName` moves both sides together instead of
 * silently splitting them.
 *
 * THE ROUND-3 PRESCRIPTION WAS TESTED, NOT ASSUMED, AND IT WAS INSUFFICIENT.
 * The prescription was `identifierOf(declaration) === generated.type` — a check
 * on the ROOT declaration only. It passes on the worst case. For
 * `$defs: {Pet: {id: 'Owner'}, Owner: {…}}` the root declaration really is named
 * correctly, while the file emits `interface Owner` carrying Pet's body and
 * `interface Owner1` carrying Owner's, with `p?: Owner` silently pointing at the
 * wrong schema and `tsc` reporting zero diagnostics. So the check has two halves
 * and needs both:
 *
 *   1. THE ROOT CHECK — the name the call RETURNS is declared somewhere in the
 *      output. This is `generateTypeForSchema`'s own promise ("the declaration
 *      declares what this function returns") stated as an assertion.
 *   2. THE SET CHECK — every identifier emitted anywhere in the output is in the
 *      entitled set. This is the half that catches the silent case, via the
 *      unentitled counter-minted `Owner1`.
 *
 * THE ROOT CHECK IS NOT "THE FIRST DECLARATION", AND THAT WAS MEASURED RATHER
 * THAN REASONED. The prescription said the root declaration always comes first;
 * it does not. The generator emits named TYPES before named INTERFACES, so a
 * `$defs` entry that compiles to a type alias — which is exactly what AC6's
 * example reflection produces, since it sets `tsType` on the node — is emitted
 * ABOVE the root interface. Asserting on position rejected four legitimate
 * reflection fixtures. Position is a formatting detail; "the returned name is
 * declared" is the property.
 *
 * HOW THE ENTITLED SET IS DERIVED, mechanism by mechanism, all in the installed
 * `json-schema-to-typescript@15.0.4`:
 *
 * - `dist/src/resolver.js:21` does `dereferencedPaths.set(schema, $ref)` — keyed
 *   on the RAW `$ref` STRING, so a `$ref` string is what a referenced subschema
 *   is remembered by.
 * - `dist/src/normalizer.js:61-83` ("Add an $id to anything that needs it") sets
 *   `schema.$id = toSafeString(justName(dereferencedName))` for any referenced
 *   subschema carrying neither `$id` nor `title`, and sets the ROOT's `$id` from
 *   the `name` passed to `compile()`.
 * - `dist/src/parser.js:274` resolves a declaration name as
 *   `customName?.() || schema.title || schema.$id || keyNameFromDefinition`.
 *   With the strip in place the first two are gone and `keyNameFromDefinition`
 *   is `undefined` on every invocation, so the synthesised `$id` is the only
 *   source left.
 * - `dist/src/utils.js:186-204` `generateName` is `toSafeString(from)`, or
 *   `'NoName'` when that is empty, then a decimal counter appended while the
 *   name is already taken.
 * - `justName(f) = stripExtension(basename(f))`, so `#/definitions/pet.owner`
 *   yields `pet` — which is why a `$defs` key containing a dot is NOT named
 *   after the whole key. Observed behaviour, not a guess.
 *
 * COUNTER SUFFIXES ARE ENTITLED ONLY BY GENUINE COLLISION, AND MULTIPLICITY IS
 * COUNTED IN POINTER SITES. For a base `b` reached by `m` sites the entitled
 * names are `b` plus `b1 … b(m-1)`, because `generateName` appends a counter
 * exactly when a second thing collapses onto a base already taken
 * (`#/$defs/pet-owner` and `#/$defs/pet_owner` really do emit `PetOwner` and
 * `PetOwner1`; three such keys emit `PetOwner`, `PetOwner1`, `PetOwner2`). With
 * `m === 1` a counter suffix is NOT entitled, and that is precisely what catches
 * the silent case — so the tolerance must not be loosened to `b1 … b(m)`.
 *
 * WHAT COUNTS AS A SITE IS THE WHOLE BOUND, AND IT IS MEASURED RATHER THAN
 * REASONED. Two wrong answers were tried first. Counting DISTINCT `$ref` STRINGS
 * is too tight and rejects legitimate fixtures: a node carrying `$ref` AND any
 * sibling key is merged by `json-schema-ref-parser` into a NEW object, so it is a
 * second identity for the parser and gets its own declaration even though the
 * pointer string is one already seen. Counting every `$ref` OCCURRENCE is too
 * loose in the case that matters: `plugin-openapi` hoists `components/schemas`
 * into `$defs`, so a schema referenced from two properties is the ORDINARY
 * shape, and giving each occurrence a counter would entitle the very `Owner1`
 * this check exists to catch. The rule that fits the library exactly is:
 *
 *     multiplicity(base) = (distinct plain `$ref` STRINGS with that base)
 *                        + (number of `$ref` NODES carrying a sibling key)
 *
 * where "plain" means the object holding the `$ref` has no other key. Any number
 * of plain pointers to one TARGET collapse onto ONE declaration, because
 * ref-parser substitutes the same object for all of them; every sibling-bearing
 * pointer is a fresh object and so a fresh declaration.
 *
 * THE PLAIN SIDE DE-DUPLICATES BY POINTER, NOT BY BASE, and that distinction is
 * load-bearing rather than pedantic. `#/$defs/pet-owner` and `#/$defs/pet_owner`
 * are two plain pointers to two different targets whose names both collapse onto
 * `PetOwner`, and the library really does emit `PetOwner` AND `PetOwner1` for
 * them. Keying the plain side on the base instead rejected that shipped fixture.
 * Measured across seventeen shapes — plain ×1…×4, sibling ×1…×3, mixtures,
 * `allOf`-wrapped, inside array `items`, self-recursive with and without a
 * sibling, an unknown `x-` key as the sibling, and two distinct plain pointers
 * onto one base — and pinned as a table in
 * `test/generate-request-types-names.test.ts`.
 *
 * IT IS STILL AN OVER-APPROXIMATION, DELIBERATELY, IN THE ONE SAFE DIRECTION.
 * Like the blind `$ref` collection below, it can only WIDEN the entitled set, so
 * it can miss a defect but can never abort a valid generation — and aborting
 * valid generations is the failure this check must not have. The residual cost,
 * stated rather than hidden: a hijacked `Owner1` goes unseen only if the
 * description ALSO reaches `Owner` through two or more SIBLING-BEARING `$ref`
 * nodes. Plain references, however many, no longer buy the hijack any cover. The
 * strip in `type-names.ts` is still the fix; this is the net under it.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One `$ref` node: where it points, and whether it points and nothing else. */
type RefSite = {
  readonly pointer: string;
  readonly plain: boolean;
};

/**
 * Every `$ref` NODE in the tree, collected BLINDLY — any key named `$ref` whose
 * value is a string, at any depth, inside arrays included — each tagged with
 * whether its holder carries any other key, because that is what decides whether
 * `json-schema-ref-parser` substitutes the shared target or a fresh merged copy.
 *
 * The blindness is deliberate and is the opposite choice from
 * `stripNameKeywordsInPlace`, which must be position-aware. `json-schema-ref-parser`
 * dereferences blindly too, so a blind collection is the faithful mirror of what
 * populates `dereferencedPaths`. And the asymmetry is safe in exactly one
 * direction: a blind collection can only WIDEN the entitled set, so it can
 * produce a false NEGATIVE but never a false POSITIVE. A position-aware
 * collection could miss a position the library dereferences and abort a
 * perfectly good generation, which is the failure mode that matters here.
 */
function collectRefSites(node: unknown, into: RefSite[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefSites(item, into);
    }

    return;
  }

  if (!isPlainObject(node)) {
    return;
  }

  const entries = Object.entries(node);

  for (const [key, value] of entries) {
    if (key === '$ref' && typeof value === 'string') {
      into.push({ pointer: value, plain: entries.length === 1 });
      continue;
    }

    collectRefSites(value, into);
  }
}

/** The base the library derives from one name source, its own way round. */
function baseNameOf(source: string): string {
  return toSafeString(justName(source)) || 'NoName';
}

/**
 * Every identifier the library is entitled to declare for `schema` compiled
 * under `name`, where `schema` is the tree AS HANDED TO `compile()` — i.e. after
 * `convertDefsToDefinitions`, so its pointers are already `#/definitions/…`.
 */
export function entitledNames(
  schema: unknown,
  name: string,
): ReadonlySet<string> {
  const sites: RefSite[] = [];

  collectRefSites(schema, sites);

  const multiplicity = new Map<string, number>();
  const claim = (base: string): void => {
    multiplicity.set(base, (multiplicity.get(base) ?? 0) + 1);
  };

  claim(baseNameOf(name));

  // Every sibling-bearing pointer is its own declaration. Plain pointers
  // de-duplicate by POINTER STRING and not by base: ref-parser substitutes one
  // shared object for every plain pointer to the SAME target, but two different
  // targets are two declarations even where their names collapse onto one base
  // — `#/$defs/pet-owner` and `#/$defs/pet_owner` are both plain, both
  // `PetOwner`, and really do emit `PetOwner` and `PetOwner1`.
  const plainPointers = new Set<string>();

  for (const site of sites) {
    if (site.plain) {
      plainPointers.add(site.pointer);
      continue;
    }

    claim(baseNameOf(site.pointer));
  }

  for (const pointer of plainPointers) {
    claim(baseNameOf(pointer));
  }

  const entitled = new Set<string>();

  for (const [base, count] of multiplicity) {
    entitled.add(base);

    for (let counter = 1; counter < count; counter += 1) {
      entitled.add(`${base}${counter}`);
    }
  }

  return entitled;
}

function quoteList(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(', ');
}

/**
 * Asserts the postcondition, throwing `GeneratedNameEscapeError` when it fails.
 *
 * Called at the single `compile()` boundary in `src/`
 * (`src/hooks/generate-request-types.ts`), which every producer of declarations
 * routes through — the v2 surface, the example bases and the frozen v1 path
 * alike — so one call covers all of them.
 */
export function assertEmittedNamesWereIssued(
  compiled: string,
  schema: unknown,
  name: string,
): void {
  const entitled = entitledNames(schema, name);
  const declared = splitDeclarations(compiled).map((declaration) =>
    identifierOf(declaration),
  );
  const escaped = declared.filter(
    (identifier) => identifier.length > 0 && !entitled.has(identifier),
  );

  if (declared.includes(name) && escaped.length === 0) {
    return;
  }

  const faults: string[] = [];

  if (!declared.includes(name)) {
    faults.push(
      `it declares ${quoteList([...new Set(declared)])} but never "${name}"`,
    );
  }

  if (escaped.length > 0) {
    faults.push(
      `it declares ${quoteList([...new Set(escaped)])}, which this generator never issued`,
    );
  }

  throw new ThymianBaseError(
    `The compiled schema for "${name}" names declarations this generator did not choose: ${faults.join('; ')}.`,
    {
      name: 'GeneratedNameEscapeError',
      suggestions: [
        'This is a defect in the generated type surface, not in the API description.',
        'Please report it, with the description that triggered it.',
      ],
    },
  );
}
