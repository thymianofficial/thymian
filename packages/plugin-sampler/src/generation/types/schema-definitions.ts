import { compareStrings } from './type-names.js';

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
 * A two-level lookup: definition name, then canonical content, yielding the name
 * that content will be emitted under. Built over every schema the surface will
 * compile, so the assignment is global.
 */
export type DefinitionNameAssignment = ReadonlyMap<
  string,
  ReadonlyMap<string, string>
>;

/**
 * Assigns one emitted name per (definition name, distinct content) pair. The
 * first content in byte order keeps the bare name so the common case — one
 * content per name — never gets a suffix at all.
 */
export function assignDefinitionNames(
  schemas: Iterable<unknown>,
): DefinitionNameAssignment {
  const contentsByName = new Map<string, Set<string>>();

  for (const schema of schemas) {
    for (const [name, definition] of Object.entries(
      rootDefinitionsOf(schema),
    )) {
      const contents = contentsByName.get(name) ?? new Set<string>();

      contents.add(canonicalJson(definition));
      contentsByName.set(name, contents);
    }
  }

  const assignment = new Map<string, Map<string, string>>();

  for (const [name, contents] of contentsByName) {
    const perContent = new Map<string, string>();
    const sorted = [...contents].sort(compareStrings);

    for (const [index, content] of sorted.entries()) {
      perContent.set(content, index === 0 ? name : `${name}_${index + 1}`);
    }

    assignment.set(name, perContent);
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
  const renamed: Record<string, unknown> = {};

  for (const [name, definition] of Object.entries(defs)) {
    const assignedName =
      assignment.get(name)?.get(canonicalJson(definition)) ?? name;

    if (assignedName !== name) {
      renames.set(name, assignedName);
    }

    renamed[assignedName] = definition;
  }

  if (renames.size === 0) {
    return;
  }

  schema['$defs'] = renamed;
  rewriteRefsInPlace(schema, renames);
}
