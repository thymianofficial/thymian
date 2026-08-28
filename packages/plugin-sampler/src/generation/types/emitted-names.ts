import { ThymianBaseError } from '@thymian/core';
import {
  justName,
  toSafeString,
} from 'json-schema-to-typescript/dist/src/utils.js';

import { identifierOf, splitDeclarations } from './declaration-set.js';
import { walkSubschemaNodes } from './type-names.js';

/**
 * The runtime postcondition on `compile()`: every declaration the library
 * emitted is one this generator asked for, and every schema this generator
 * pointed at got a declaration.
 *
 * WHY A POSTCONDITION AND NOT ANOTHER KEYWORD. `type-names.ts` strips the
 * keywords a schema can name itself with, and that list has now been wrong three
 * times — `title`, then `$id`, then `id` — each time found by the same probe,
 * each time silent in the worst case. Enumerating what the library MIGHT do
 * cannot close a class; checking what it ACTUALLY did can.
 *
 * ROUND 5 REPLACED THE MECHANISM, BECAUSE ROUND 4's ABORTED VALID INPUT.
 * Round 4 computed an EXACT entitled set by reimplementing the library's counter
 * arithmetic: for a base reached by `m` pointer sites, `b` plus `b1 … b(m-1)`.
 * That model is wrong, and it was wrong in the one direction the docblock
 * promised it could not be — it rejected correct descriptions. Three independent
 * reproductions, all measured against `json-schema-to-typescript@15.0.4`:
 *
 * - `generateName` (`dist/src/utils.js:186-204`) draws its counter from ONE
 *   global `usedNames` set for the whole `compile()`, not from a per-base one.
 *   `$defs: {Pet, Pet1, pet}` — which `plugin-openapi`'s `createDefinitionName`
 *   really does produce, since it preserves case and digits — emits `Pet`,
 *   `Pet1`, `Pet2`. Round 4 entitled only `Pet` and `Pet1`, so it aborted.
 * - The counter walks PAST names other definitions already occupy, so the suffix
 *   is not contiguous: `Pet` reached twice with `Pet1` also present emits
 *   `Pet11`.
 * - The normalizer only synthesises `$id` for object- and array-typed targets
 *   (`normalizer.js:61-83`); for a scalar it returns early, so
 *   `keyNameFromDefinition` — the RAW `$defs` key — names the declaration and
 *   `justName` never strips the dot. `$defs: {'pet.owner': {type: 'string'}}`
 *   declares `PetOwner`, not `Pet`. Round 4's docblock asserted that branch was
 *   unreachable. It is reachable.
 *
 * The lesson is not "get the arithmetic right". It is that reimplementing a
 * dependency's private name allocator is the same bet that lost three times
 * already. So the counter is no longer modelled at all.
 *
 * A THIRD MECHANISM WAS TRIED HERE AND WITHDRAWN. Round 5 added an OBLIGATION
 * half: every `$ref` in a position the library parses must have produced a
 * declaration. It was meant to catch the silent hijack directly — when
 * `$defs.Pet` renames itself, nothing declares `Pet` any more — and for that
 * case it worked. It was also WRONG, in the same direction and for the same
 * underlying reason as the counter model it replaced: it assumed a parsed `$ref`
 * yields a declaration, and the library declares nothing for most positions.
 * Measured: a `$ref` under `not`, `if`, `then`, `else`, `contains`,
 * `propertyNames`, `prefixItems`, `additionalItems` or `unevaluatedProperties`
 * produced a false obligation and aborted a VALID description — and
 * `plugin-openapi` rewrites pointers into exactly those positions
 * (`json-schema.processor.ts` `schemaValueKeys`), so it was reachable from an
 * ordinary document.
 *
 * That is twice that a model of this library's declaration behaviour has
 * aborted valid input. The lesson is being taken rather than refined: THIS
 * MODULE NO LONGER PREDICTS WHAT THE LIBRARY WILL DECLARE. It only checks what
 * it did declare against what the schema can account for, which needs no model.
 *
 * WHAT IS ASSERTED NOW, and both properties are sound in the direction that
 * matters — neither can abort a generation the library got right:
 *
 *   1. THE ROOT CHECK — the name the call RETURNS is declared somewhere in the
 *      output. `generateTypeForSchema`'s own promise, stated as an assertion.
 *   2. PERMISSION, over-approximating — every identifier emitted anywhere traces
 *      back to a name source that exists in the schema, ignoring any counter
 *      suffix. Built from a BLIND `$ref` collection, so it can only ever be too
 *      GENEROUS: it can miss a defect, but it can never abort a valid
 *      generation. Aborting valid generations is the failure this check must not
 *      have, because it fires on a user's own API description.
 *
 * WHAT THAT COSTS, STATED PLAINLY. A hijack that lands on a name the schema DOES
 * account for — `$defs: {Pet: {<unknown keyword>: 'Owner'}, Owner: {…}}`, which
 * emits `Owner` and `Owner1` — is no longer caught here. The STRIP in
 * `type-names.ts` is what closes that, and it is the thing under mutation test;
 * this module is a net for the residue, catching a name the schema cannot
 * account for at all. `DeclarationSet` catches the other half, one identifier
 * with two bodies. Claiming more than that is what produced two false-abort
 * regressions.
 *
 * THE ROOT CHECK IS NOT "THE FIRST DECLARATION", AND THAT WAS MEASURED RATHER
 * THAN REASONED. The generator emits named TYPES before named INTERFACES, so a
 * `$defs` entry compiling to a type alias — exactly what AC6's example
 * reflection produces, since it sets `tsType` — is emitted ABOVE the root
 * interface. Position is a formatting detail; "the returned name is declared" is
 * the property.
 *
 * WHAT THIS STILL DOES NOT CATCH, stated rather than hidden: two declarations
 * that collide on ONE identifier across DIFFERENT `compile()` calls. This
 * function sees one call at a time and structurally cannot. `DeclarationSet`
 * owns that check, at the point where every declaration in the surface is in
 * hand.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The names the library could derive from one `$ref` string. BOTH derivations
 * are kept because which one wins depends on the TARGET's type, which this
 * module does not model: the normalizer synthesises
 * `$id = toSafeString(justName(pointer))` for object- and array-typed targets,
 * and for anything else `keyNameFromDefinition` — `toSafeString` of the raw,
 * pointer-unescaped final token — is what names the declaration.
 *
 * Round 4 predicted the winner and got it wrong. Accepting either is what makes
 * the obligation half sound without teaching it the library's type dispatch.
 */
function baseCandidatesOf(source: string): readonly string[] {
  const finalToken = source.split('/').pop() ?? source;
  // JSON Pointer escaping, then the URI layer above it. A key really can
  // contain `/` or `~`, and `plugin-openapi` emits the escaped form.
  let unescaped = finalToken.replaceAll('~1', '/').replaceAll('~0', '~');

  try {
    unescaped = decodeURIComponent(unescaped);
  } catch {
    // A stray `%` is not an encoding error worth aborting a generation over;
    // the raw token is still a candidate.
  }

  const candidates = [
    toSafeString(justName(source)),
    toSafeString(unescaped),
    toSafeString(finalToken),
  ].filter((candidate) => candidate.length > 0);

  return candidates.length > 0 ? [...new Set(candidates)] : ['NoName'];
}

const TRAILING_COUNTER = /^(.*?)\d+$/;

/**
 * The identifier with any trailing counter removed. `generateName` appends a
 * decimal counter to an already-taken name, so `Pet2` and `Pet11` are both the
 * base `Pet` wearing a suffix — and because the counter pool is global, WHICH
 * suffix is not something this module gets to predict.
 *
 * The un-suffixed identifier is returned as well, because a base may legitimately
 * end in a digit (`$defs.Pet1` is a name in its own right).
 */
function baseFormsOf(identifier: string): readonly string[] {
  const stripped = TRAILING_COUNTER.exec(identifier)?.[1];

  return stripped !== undefined && stripped.length > 0
    ? [identifier, stripped]
    : [identifier];
}

/**
 * Every `$ref` string in the tree, collected BLINDLY — any key named `$ref`
 * whose value is a string, at any depth, inside arrays included.
 *
 * The blindness is deliberate and is the opposite choice from
 * `stripNameKeywordsInPlace`, which must be position-aware.
 * `json-schema-ref-parser` dereferences blindly too, so a blind collection is
 * the faithful mirror of what it can substitute. Used ONLY for the permission
 * half, where being too generous is safe by construction.
 */
function collectRefsBlindly(node: unknown, into: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefsBlindly(item, into);
    }

    return;
  }

  if (!isPlainObject(node)) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      into.push(value);
      continue;
    }

    collectRefsBlindly(value, into);
  }
}

/**
 * Rejects a `$ref` whose value is not a string, BEFORE `compile()` sees it.
 *
 * It has to run before, not as part of the postcondition: the resolver leaves
 * such a node untouched and the library then fails deep in its parser with
 * `Refs should have been resolved by the resolver!` — an error that names
 * neither the keyword nor the schema, and that arrives before any postcondition
 * could run.
 *
 * IT IS POSITION-AWARE, unlike the blind collection below, and the asymmetry is
 * the whole point. A blind walk that THROWS is not "safely over-generous" — it
 * is over-eager: `examples: [{$ref: {…}}]` is example DATA describing a JSON
 * Schema document, which is ordinary for this product, and rejecting it aborted
 * a generation that the library handles fine. Collecting blindly can only widen
 * a permitted set; THROWING blindly rejects valid input. Only a `$ref` at a
 * position the library would actually try to resolve is malformed.
 */
export function assertReferencesAreStrings(schema: unknown): void {
  walkSubschemaNodes(schema, (node) => {
    if (!('$ref' in node)) {
      return;
    }

    const ref = node['$ref'];

    if (typeof ref === 'string') {
      return;
    }

    throw new ThymianBaseError(
      `A schema uses "$ref" with a ${Array.isArray(ref) ? 'array' : typeof ref} value, but a reference must be a string.`,
      {
        name: 'MalformedSchemaError',
        suggestions: [
          'Give the "$ref" a pointer string, such as "#/$defs/Pet", or remove it.',
        ],
      },
    );
  });
}

/**
 * The name sources a declaration may legitimately trace back to: the name this
 * generator handed `compile()`, plus every `$ref` anywhere in the tree.
 *
 * Exported for the tests, which assert it against the library's real output
 * rather than against this module's arithmetic.
 */
export function permittedBases(
  schema: unknown,
  name: string,
): ReadonlySet<string> {
  const refs: string[] = [];

  collectRefsBlindly(schema, refs);

  const bases = new Set<string>([name, ...baseCandidatesOf(name)]);

  for (const ref of refs) {
    for (const candidate of baseCandidatesOf(ref)) {
      bases.add(candidate);
    }
  }

  return bases;
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
  const declared = splitDeclarations(compiled)
    .map((declaration) => identifierOf(declaration))
    .filter((identifier) => identifier.length > 0);

  const bases = permittedBases(schema, name);
  const escaped = declared.filter((identifier) =>
    baseFormsOf(identifier).every((form) => !bases.has(form)),
  );

  if (declared.includes(name) && escaped.length === 0) {
    return;
  }

  const faults: string[] = [];

  if (!declared.includes(name)) {
    faults.push(
      declared.length === 0
        ? `it declares nothing at all, but should declare "${name}"`
        : `it declares ${quoteList([...new Set(declared)])} but never "${name}"`,
    );
  }

  if (escaped.length > 0) {
    faults.push(
      `it declares ${quoteList([...new Set(escaped)])}, which no name in the schema accounts for`,
    );
  }

  throw new ThymianBaseError(
    `The generated types for "${name}" do not match the names this generator issued: ${faults.join('; ')}.`,
    {
      name: 'GeneratedNameEscapeError',
      suggestions: [
        'A schema keyword in the API description may be naming a type itself — check for "title", "$id", "id" or "extends" on the schemas involved, and remove or rename it.',
        'If the description has no such keyword, this is a defect in the generated type surface: please report it, with the description that triggered it.',
      ],
    },
  );
}
