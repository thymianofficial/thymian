import { isRecord } from '@thymian/core';
import { compile, type JSONSchema } from 'json-schema-to-typescript';

import { type Declaration, splitDeclarations } from './declaration-set.js';
import { reflectExamples } from './example-reflection.js';

export type GeneratedType = {
  /** The declarations this type is made of: its own, plus every named
   * component it references. */
  declarations: Declaration[];
  /** The name of the root declaration, usable wherever a type is expected. */
  type: string;
};

const UNKNOWN: GeneratedType = { declarations: [], type: 'unknown' };

/**
 * Restores the boolean form of a schema that forbids everything.
 *
 * `additionalProperties: false` reaches the sampler as `{ not: {} }`, which is
 * the correct JSON Schema for it (`plugin-openapi`'s `normalizeSchema` turns
 * every boolean schema into its object form). The emitter cannot express it:
 * it reads any object in that position as a value schema and emits
 * `[k: string]: { [k: string]: unknown }`, an index signature that every
 * declared property then fails to satisfy — `TS2411`, six times over on the
 * demo description. Handed the boolean it emits no index signature at all,
 * which is what a closed object is.
 *
 * Only this position is rewritten. `{ not: {} }` elsewhere means `never`, which
 * the emitter is free to render however it likes.
 */
function closedObjectsToBoolean(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(closedObjectsToBoolean);
  }

  if (!isRecord(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    out[key] =
      key === 'additionalProperties' && forbidsEverything(value)
        ? false
        : closedObjectsToBoolean(value);
  }

  return out;
}

/** Whether a schema admits no value at all, in the shape normalization emits. */
function forbidsEverything(schema: unknown): boolean {
  return (
    isRecord(schema) &&
    Object.keys(schema).length === 1 &&
    isRecord(schema['not']) &&
    Object.keys(schema['not']).length === 0
  );
}

/**
 * `$defs` is the 2020-12 spelling of the keyword `definitions` names in
 * draft-07, and `json-schema-to-typescript` only resolves the older one. So
 * both the key **and** every `$ref` pointing into it are rewritten — renaming
 * the key alone leaves the pointers aimed at a token that no longer exists,
 * which fails the whole generation with `Missing $ref pointer`.
 */
function defsToDefinitions(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(defsToDefinitions);
  }

  if (!isRecord(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === '$ref' && typeof value === 'string') {
      out[key] = value.replace(/\/\$defs\//g, '/definitions/');

      continue;
    }

    out[key === '$defs' ? 'definitions' : key] = defsToDefinitions(value);
  }

  // A top-level `$ref` beside `definitions` is what a description produces when
  // a body is exactly one named schema, and the emitter cannot compile that
  // shape: wrapping the reference in an `allOf` says the same thing in a shape
  // it can.
  if ('$ref' in out && 'definitions' in out) {
    const ref = out['$ref'];

    delete out['$ref'];
    out['allOf'] = [{ $ref: ref }];
  }

  return out;
}

/**
 * The keywords a schema names ITSELF with, in the library's own precedence
 * order. All three outrank the name `compile()` is handed, so all three have to
 * be gone before the schema is compiled.
 *
 * The library resolves a declaration name as
 * `options.customName?.(…) || schema.title || schema.$id || keyNameFromDefinition`
 * (`json-schema-to-typescript@15/dist/src/parser.js`), and its normalizer only
 * synthesises the `$id` we rely on `if (!schema.$id && !schema.title …)`. So a
 * schema-level `title` — which any hand-written OpenAPI document is likely to
 * carry — makes the library declare `export interface Astronaut` while the
 * surface still references the name we asked for, and the committed file no
 * longer compiles. `id` is not covered by removing `$id`: the normalizer runs a
 * `Transform id to $id` rule AFTER this pass, so the draft-04 spelling walks
 * back in through the very keyword `$id` was removed to protect.
 *
 * None of the three carries type information. `description` is the keyword the
 * library turns into a JSDoc comment and is deliberately KEPT.
 *
 * Enumerating keywords is not a proof, which is why {@link assertDeclares}
 * turns a keyword this list forgets into a loud failure rather than a surface
 * that silently does not compile.
 */
const NAME_KEYWORDS = ['title', '$id', 'id'] as const;

/**
 * Where a schema nests another schema, by the shape of the position.
 *
 * The walk below has to be keyword-aware rather than a blind key filter: `id`
 * is a name keyword in a SCHEMA position and an ordinary property NAME inside
 * `properties`, so filtering every key called `id` deletes the `id` property
 * from every body that has one. That is not hypothetical — it is what the first
 * version of this strip did, and the type surface it produced was clean
 * TypeScript describing the wrong object.
 */
const NESTED_SCHEMA = {
  /** Positions holding exactly one schema. */
  single: [
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
  ],
  /** Positions holding an array of schemas. */
  list: ['allOf', 'anyOf', 'oneOf', 'prefixItems'],
  /** Positions holding a name-to-schema map, where the KEY is not a keyword. */
  map: [
    '$defs',
    'definitions',
    'dependentSchemas',
    'patternProperties',
    'properties',
  ],
} as const;

/**
 * Strips every keyword a schema could name itself with, at every schema
 * position — the root, a nested property, an array's element, a composition
 * branch and a named component alike, because the library resolves the name the
 * same way at each of them.
 */
function stripNameKeywords(schema: unknown): unknown {
  if (!isRecord(schema)) {
    return schema;
  }

  const node: Record<string, unknown> = { ...schema };

  for (const keyword of NAME_KEYWORDS) {
    delete node[keyword];
  }

  for (const keyword of NESTED_SCHEMA.single) {
    if (keyword in node) {
      node[keyword] = stripNameKeywords(node[keyword]);
    }
  }

  for (const keyword of NESTED_SCHEMA.list) {
    const branches = node[keyword];

    if (Array.isArray(branches)) {
      node[keyword] = branches.map(stripNameKeywords);
    }
  }

  for (const keyword of NESTED_SCHEMA.map) {
    const members = node[keyword];

    if (isRecord(members)) {
      node[keyword] = Object.fromEntries(
        Object.entries(members).map(([name, member]) => [
          name,
          stripNameKeywords(member),
        ]),
      );
    }
  }

  return node;
}

/**
 * Fails if the library did not declare under the name it was handed.
 *
 * The surface references `typeName`, so a declaration under any other name is a
 * dangling reference in a committed file — a `tsc` error for the user, in
 * generated code they are told not to edit. Catching it here costs one regex
 * and names the schema that caused it.
 */
function assertDeclares(declaration: string, typeName: string): void {
  const declared = new RegExp(
    `^export (?:interface|type) ${typeName}\\b`,
    'm',
  ).test(declaration);

  if (!declared) {
    throw new Error(
      `The type generator asked for a declaration named ${typeName} and did ` +
        `not get one. A schema keyword is overriding the name; see ` +
        `NAME_KEYWORDS in schema-type.ts.`,
    );
  }
}

/** Whether a media type is one whose body has a JSON shape worth typing. */
export function isJsonMediaType(mediaType: string): boolean {
  const essence = mediaType.split(';', 1)[0]?.trim().toLowerCase() ?? '';

  return essence === 'application/json' || /\+json$/.test(essence);
}

/**
 * The TypeScript type for one schema, with its `examples` reflected into
 * property types.
 *
 * A non-JSON media type is `unknown`: the sampler can generate a body for it,
 * but a schema is not what describes it, so pretending to type it would be
 * worse than admitting we do not.
 */
export async function generateSchemaType(
  schema: unknown,
  mediaType: string,
  typeName: string,
): Promise<GeneratedType> {
  if (!isJsonMediaType(mediaType)) {
    return UNKNOWN;
  }

  if (schema === undefined) {
    return UNKNOWN;
  }

  const declaration = await compile(
    defsToDefinitions(
      closedObjectsToBoolean(
        stripNameKeywords(reflectExamples(structuredClone(schema))),
      ),
    ) as JSONSchema,
    typeName,
    {
      bannerComment: '',
      additionalProperties: true,
      style: { semi: false },
      $refOptions: { mutateInputSchema: true },
    },
  );

  assertDeclares(declaration, typeName);

  return { declarations: splitDeclarations(declaration), type: typeName };
}
