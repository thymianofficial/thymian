import type { ThymianSchema } from '@thymian/core';
import type { OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';

import { resolveOpenApiReference } from './openapi-reference-resolver.js';

const keysToRemove = new Set([
  'nullable',
  'example',
  'deprecated',
  'discriminator',
  'externalDocs',
  'readOnly',
  'writeOnly',
]);

const schemaArrayKeys = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const schemaRecordKeys = new Set([
  '$defs',
  'dependentSchemas',
  'patternProperties',
  'properties',
]);
const schemaValueKeys = new Set([
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
]);

export type Draft202012SchemaObject =
  | (OpenAPIV31.SchemaObject & {
      prefixItems?: Draft202012SchemaObject[];
      unevaluatedItems?: boolean;
      contains?: Draft202012SchemaObject;
      minContains?: number;
      maxContains?: number;
      patternProperties?: {
        [pattern: string]: Draft202012SchemaObject;
      };
      unevaluatedProperties?: boolean;
      exclusiveMaximum?: number;
      exclusiveMinimum?: number;
      contentEncoding?: string;
    })
  | boolean;

type ProcessSchemaOptions = {
  document: OpenAPIV31.Document;
};

type SchemaNormalizationContext = {
  definitionNamesByRef: Map<string, string>;
  definitions: Record<string, ThymianSchema>;
  document: OpenAPIV31.Document;
  usedDefinitionNames: Set<string>;
};

export function processSchema(
  schema: Draft202012SchemaObject,
  options: ProcessSchemaOptions,
): ThymianSchema {
  const context = createSchemaNormalizationContext(options.document);
  const normalized = normalizeSchema(schema, context);

  if (Object.keys(context.definitions).length === 0) {
    return normalized;
  }

  return {
    ...normalized,
    $defs: {
      ...context.definitions,
      ...(normalized.$defs ?? {}),
    },
  };
}

export function addExampleToSchema(
  schema: ThymianSchema,
  example: unknown,
): ThymianSchema {
  if (isObjectRecord(schema) && typeof example !== 'undefined') {
    (schema.examples ??= []).push(example);
  }

  return schema;
}

function createSchemaNormalizationContext(
  document: OpenAPIV31.Document,
): SchemaNormalizationContext {
  return {
    definitionNamesByRef: new Map(),
    definitions: {},
    document,
    usedDefinitionNames: new Set(),
  };
}

function normalizeSchema(
  schema: Draft202012SchemaObject,
  context?: SchemaNormalizationContext,
): ThymianSchema {
  if (schema === false) {
    return { not: {} };
  }

  if (schema === true) {
    return {};
  }

  return normalizeSchemaObject(schema, context);
}

function normalizeSchemaObject(
  schema: Exclude<Draft202012SchemaObject, boolean>,
  context?: SchemaNormalizationContext,
): ThymianSchema {
  const result: Record<string, unknown> = {};

  if (Object.hasOwn(schema, 'example')) {
    const examples = schema.examples ? structuredClone(schema.examples) : [];

    if (!Array.isArray(examples)) {
      throw new Error(
        `Property "examples" must be an array but got type ${typeof examples}.`,
      );
    }

    examples.push(structuredClone(schema.example));
    result.examples = examples;
  }

  for (const [key, value] of Object.entries(schema)) {
    if (keysToRemove.has(key) || key === 'example') {
      continue;
    }

    if (typeof value === 'undefined') {
      continue;
    }

    if (key === '$ref') {
      result.$ref =
        context && typeof value === 'string'
          ? localizeReference(value, context)
          : value;
      continue;
    }

    if (schemaArrayKeys.has(key) && Array.isArray(value)) {
      result[key] = value.map((item) => normalizeSchema(item, context));
      continue;
    }

    if (schemaRecordKeys.has(key) && isObjectRecord(value)) {
      result[key] = Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [
          entryKey,
          normalizeSchema(entryValue as Draft202012SchemaObject, context),
        ]),
      );
      continue;
    }

    if (schemaValueKeys.has(key)) {
      result[key] = normalizeSchema(value as Draft202012SchemaObject, context);
      continue;
    }

    result[key] = structuredClone(value);
  }

  return result as ThymianSchema;
}

function localizeReference(
  ref: string,
  context: SchemaNormalizationContext,
): string {
  if (!ref.startsWith('#')) {
    throw new Error(
      `Only internal schema references are supported but got "${ref}".`,
    );
  }

  const name = getOrCreateDefinitionName(ref, context);

  return `#/$defs/${escapeJsonPointerSegment(name)}`;
}

function getOrCreateDefinitionName(
  ref: string,
  context: SchemaNormalizationContext,
): string {
  const existingName = context.definitionNamesByRef.get(ref);

  if (existingName) {
    return existingName;
  }

  const name = createDefinitionName(ref, context.usedDefinitionNames);
  context.definitionNamesByRef.set(ref, name);

  const target = resolveInternalReference(context.document, ref);
  context.definitions[name] = normalizeSchema(target, context);

  return name;
}

function createDefinitionName(ref: string, usedNames: Set<string>): string {
  const fragment = ref.replace(/^#\/?/, '');
  const rawSegments = fragment
    .split('/')
    .filter(Boolean)
    .map((segment) => unescapeJsonPointerSegment(segment));
  const lastSegment = rawSegments[rawSegments.length - 1] ?? 'schema';
  const baseName =
    lastSegment.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '') ||
    'schema';

  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}_${suffix++}`;
  }

  usedNames.add(candidate);

  return candidate;
}

function resolveInternalReference(
  document: OpenAPIV31.Document,
  ref: string,
): Draft202012SchemaObject {
  return resolveOpenApiReference<Draft202012SchemaObject>(
    { $ref: ref },
    document,
    'schema',
  );
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
