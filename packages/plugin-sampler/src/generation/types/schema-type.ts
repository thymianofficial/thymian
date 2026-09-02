import { isRecord } from '@thymian/core';
import { compile, type JSONSchema } from 'json-schema-to-typescript';

import { reflectExamples } from './example-reflection.js';

export type GeneratedType = {
  /** Named declarations the type text refers to, in emission order. */
  declarations: string[];
  /** The type text itself, usable wherever a type is expected. */
  type: string;
};

const UNKNOWN: GeneratedType = { declarations: [], type: 'unknown' };

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
    defsToDefinitions(reflectExamples(structuredClone(schema))) as JSONSchema,
    typeName,
    {
      bannerComment: '',
      additionalProperties: true,
      style: { semi: false },
      $refOptions: { mutateInputSchema: true },
    },
  );

  return { declarations: [declaration.trimEnd()], type: typeName };
}
