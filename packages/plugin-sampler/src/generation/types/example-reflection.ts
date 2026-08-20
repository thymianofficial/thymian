import { canonicalJson } from './schema-definitions.js';
import { pascalSegments } from './type-names.js';

/**
 * Reflects a schema's own `examples` into the emitted types while keeping those
 * types OPEN.
 *
 * The mechanism is `json-schema-to-typescript`'s `tsType` escape hatch, which
 * "supercedes all other directives" (`dist/src/typesOfSchema.js:15-16`): the
 * cloned schema is pre-processed and `compile()` emits the union verbatim. Two
 * alternatives are deliberately NOT used — rewriting `examples` into `enum`,
 * which renders a CLOSED union and would make an unlisted-but-valid value a type
 * error; and regex post-processing of the emitted text.
 *
 * - A primitive node becomes `"A" | "B" | (string & {})`. The `& {}` is what
 *   keeps the literals visible in the language server: a bare `string` in the
 *   union collapses them.
 * - An object node becomes `{…} | {…} | <Name>Base`, where `<Name>Base` is the
 *   type `json-schema-to-typescript` would have produced, compiled separately
 *   and emitted alongside. It cannot be injected as an unreferenced `$defs`
 *   entry — unreferenced definitions are dropped — and it cannot share a node
 *   with `$ref`, because `$ref` plus `tsType` on one node emits a
 *   self-referential alias (`export type Pet = Ex | Pet`).
 *
 * Both shapes stay assignable from any value of the base type, which is the
 * whole point: an example is a hint, not a constraint.
 *
 * `enum` and `const` nodes are left exactly as they are — they are already
 * closed unions and widening them would be wrong. `$ref` nodes are left alone
 * too: following one turns a recursive schema (normal input per ADR-0013) into
 * an infinite walk, and reflecting onto one produces the self-reference above.
 */

type JsonObject = Record<string, unknown>;

/** Compiles a base schema and returns the declarations it produced. */
export type CompileBaseSchema = (
  schema: unknown,
  typeName: string,
) => Promise<readonly string[]>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `undefined` for anything that is not a single primitive type. A `type` array
 * is ambiguous (which base would `& {}` apply to?) and an absent `type` gives
 * nothing to validate the examples against, so both fall back to the base type
 * silently rather than emitting an unsound literal.
 */
function primitiveBaseOf(
  type: unknown,
): 'string' | 'number' | 'boolean' | undefined {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return undefined;
  }
}

/** Whether an example value is actually an instance of the declared type. A
 * description can carry a malformed example; emitting it as a literal would put
 * an unsound member into the union. */
function matchesDeclaredType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isPlainObject(value);
    default:
      // `array` and `null` contribute no literal worth having: an array literal
      // type is a tuple that would have to be exact, and `null` is already the
      // whole inhabited set of its type.
      return false;
  }
}

/**
 * The examples worth reflecting: declared-type-conforming, de-duplicated on
 * canonical content, first occurrence wins so the order is the description's.
 */
function usableExamples(node: JsonObject): unknown[] {
  const examples = node['examples'];
  const type = node['type'];

  if (!Array.isArray(examples) || typeof type !== 'string') {
    return [];
  }

  const seen = new Set<string>();
  const usable: unknown[] = [];

  for (const example of examples) {
    if (!matchesDeclaredType(example, type)) {
      continue;
    }

    const canonical = canonicalJson(example);

    if (seen.has(canonical)) {
      continue;
    }

    seen.add(canonical);
    usable.push(example);
  }

  return usable;
}

/** Renders a JSON value as the TypeScript type that admits exactly it. */
export function literalTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => literalTypeOf(item)).join(', ')}]`;
  }

  if (isPlainObject(value)) {
    const members = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${literalTypeOf(item)}`,
    );

    return members.length > 0 ? `{ ${members.join('; ')} }` : '{}';
  }

  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value);
    default:
      return 'unknown';
  }
}

type ReflectionContext = {
  readonly compileBase: CompileBaseSchema;
  readonly declarations: string[];
  /**
   * The root's `$defs`, already renamed and already reflected. A base compiled
   * out of a nested node carries them so its `#/$defs/` pointers still resolve;
   * they are shared by reference on purpose, so every base sees the identical
   * — therefore de-duplicable — definition text.
   */
  readonly rootDefinitions: JsonObject | undefined;
};

async function reflectObjectNode(
  node: JsonObject,
  stem: string,
  examples: readonly unknown[],
  context: ReflectionContext,
  isRoot: boolean,
): Promise<void> {
  const baseName = `${stem}Base`;
  const base: JsonObject = structuredClone(node);

  delete base['examples'];

  if (!isRoot && context.rootDefinitions && base['$defs'] === undefined) {
    base['$defs'] = context.rootDefinitions;
  }

  // The base's own children may carry examples too, so it gets the same
  // treatment before it is compiled. The recursion terminates because a base is
  // strictly smaller than the node it came from and `$ref` is never followed.
  await reflectChildren(base, baseName, context);

  context.declarations.push(...(await context.compileBase(base, baseName)));

  node['tsType'] = [
    ...examples.map((example) => literalTypeOf(example)),
    baseName,
  ].join(' | ');
}

async function reflectNode(
  node: unknown,
  stem: string,
  context: ReflectionContext,
  isRoot = false,
): Promise<void> {
  if (!isPlainObject(node)) {
    return;
  }

  // `$ref`, `enum` and `const` all mean "do not touch this node".
  if (
    node['$ref'] !== undefined ||
    node['enum'] !== undefined ||
    node['const'] !== undefined
  ) {
    return;
  }

  const examples = usableExamples(node);

  if (examples.length > 0) {
    const primitiveBase = primitiveBaseOf(node['type']);

    if (primitiveBase !== undefined) {
      node['tsType'] = [
        ...examples.map((example) => literalTypeOf(example)),
        `(${primitiveBase} & {})`,
      ].join(' | ');

      return;
    }

    if (node['type'] === 'object') {
      await reflectObjectNode(node, stem, examples, context, isRoot);

      return;
    }
  }

  await reflectChildren(node, stem, context);
}

async function reflectChildren(
  node: JsonObject,
  stem: string,
  context: ReflectionContext,
): Promise<void> {
  const properties = node['properties'];

  if (isPlainObject(properties)) {
    for (const [name, child] of Object.entries(properties)) {
      await reflectNode(child, `${stem}${pascalSegments(name)}`, context);
    }
  }

  await reflectNode(node['items'], `${stem}Item`, context);

  const prefixItems = node['prefixItems'];

  if (Array.isArray(prefixItems)) {
    for (const [index, child] of prefixItems.entries()) {
      await reflectNode(child, `${stem}Item${index}`, context);
    }
  }

  await reflectNode(
    node['additionalProperties'],
    `${stem}AdditionalProperty`,
    context,
  );

  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branches = node[keyword];

    if (!Array.isArray(branches)) {
      continue;
    }

    for (const [index, child] of branches.entries()) {
      await reflectNode(
        child,
        `${stem}${pascalSegments(keyword)}${index}`,
        context,
      );
    }
  }
}

/**
 * Reflects examples through a whole schema in place and returns the extra
 * declarations the object cases needed.
 *
 * `$defs` are reflected FIRST and exactly once, with each entry's own assigned
 * name as its stem. Both properties matter: a definition's reflected text must
 * not depend on which transaction reached it (or two sites emit one identifier
 * with two bodies), and a base compiled out of a nested node carries the
 * already-reflected definitions rather than re-reflecting them.
 */
export async function reflectExamplesInPlace(
  schema: unknown,
  typeName: string,
  compileBase: CompileBaseSchema,
): Promise<readonly string[]> {
  if (!isPlainObject(schema)) {
    return [];
  }

  const definitions = schema['$defs'];
  const rootDefinitions = isPlainObject(definitions) ? definitions : undefined;
  const context: ReflectionContext = {
    compileBase,
    declarations: [],
    rootDefinitions,
  };

  if (rootDefinitions) {
    for (const [name, definition] of Object.entries(rootDefinitions)) {
      await reflectNode(definition, pascalSegments(name), context);
    }
  }

  await reflectNode(schema, typeName, context, true);

  return context.declarations;
}
