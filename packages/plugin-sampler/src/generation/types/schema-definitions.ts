import { ThymianBaseError } from '@thymian/core';

import {
  compareStrings,
  type NameRegistry,
  safeIdentifier,
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
 * `plugin-openapi` puts them. `ThymianSchema` carries no `title`, so `$defs` is
 * also the only keyword that can name a nested declaration.
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
 * property `type-names.ts:20-24` states for site names.
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

function rootDefinitionsOf(schema: unknown): Record<string, unknown> {
  if (!isPlainObject(schema)) {
    return {};
  }

  const defs = schema['$defs'];

  return isPlainObject(defs) ? defs : {};
}

/**
 * A two-level lookup: emitted identifier, then canonical content, yielding the
 * name that content will be emitted under. Built over every schema the surface
 * will compile, so the assignment is global.
 */
export type DefinitionNameAssignment = ReadonlyMap<
  string,
  ReadonlyMap<string, string>
>;

/** A registry key for one (identifier, content) pair. */
function definitionKey(identifier: string, content: string): string {
  return `$defs\u0000${identifier}\u0000${content}`;
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
 * Assigns one emitted name per (emitted identifier, distinct content) pair,
 * through the shared registry so the result cannot collide with anything else
 * the surface declares.
 */
export function assignDefinitionNames(
  schemas: Iterable<unknown>,
  registry: NameRegistry,
): DefinitionNameAssignment {
  const assignment = new Map<string, Map<string, string>>();

  for (const schema of schemas) {
    for (const [name, definition] of sortedDefinitions(schema)) {
      const identifier = safeIdentifier(name);
      const content = canonicalJson(definition);
      const perContent =
        assignment.get(identifier) ?? new Map<string, string>();

      assignment.set(identifier, perContent);

      if (!perContent.has(content)) {
        perContent.set(
          content,
          registry.assign(definitionKey(identifier, content), identifier),
        );
      }
    }
  }

  return assignment;
}

function rewriteRef(
  value: string,
  renames: ReadonlyMap<string, string>,
): string {
  for (const [from, to] of renames) {
    const prefix = `#/$defs/${from}`;

    if (value === prefix) {
      return `#/$defs/${to}`;
    }

    if (value.startsWith(`${prefix}/`)) {
      return `#/$defs/${to}${value.slice(prefix.length)}`;
    }
  }

  return value;
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
 * targets them, wherever it sits in the tree — to the globally assigned names.
 * Mutates the clone it is handed; the caller owns the clone.
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

  const defs = schema['$defs'];

  if (!isPlainObject(defs)) {
    return;
  }

  const renames = new Map<string, string>();
  const renamed = new Map<string, unknown>();

  for (const [name, definition] of Object.entries(defs)) {
    const content = canonicalJson(definition);
    const assignedName =
      assignment.get(safeIdentifier(name))?.get(content) ??
      safeIdentifier(name);

    if (assignedName !== name) {
      renames.set(name, assignedName);
    }

    const occupant = renamed.get(assignedName);

    // Unreachable by construction — the registry hands out one name per
    // (identifier, content) pair and never repeats one — so it is a hard abort
    // rather than a silent last-write-wins. The failure it replaces was the
    // worst kind: one definition dropped, another retyped, and `tsc` reporting
    // a clean surface because the emitted file was perfectly consistent with
    // itself and wrong.
    if (occupant !== undefined && canonicalJson(occupant) !== content) {
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

    renamed.set(assignedName, definition);
  }

  schema['$defs'] = Object.fromEntries(renamed);

  if (renames.size > 0) {
    rewriteRefsInPlace(schema, renames);
  }
}
