import { isRecord, type ThymianSchema } from '@thymian/core';
import type { OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';
import traverse from 'traverse';

const keysToRemove = new Set([
  'nullable',
  'example',
  'deprecated',
  'discriminator',
  'externalDocs',
  'readOnly',
  'writeOnly',
]);

export type Draft202012SchemaObject = OpenAPIV31.SchemaObject & {
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
} & boolean;

export function processSchema(schema: Draft202012SchemaObject): ThymianSchema {
  // https://json-schema.org/draft/2020-12/draft-bhutton-json-schema-01#name-boolean-json-schemas
  if (schema === false) {
    return { not: {} };
  }

  if (schema === true) {
    return {};
  }

  return traverse(schema).map(function (node) {
    if (!this.isLeaf && isRecord(node) && node['example']) {
      node.examples ??= [];

      if (!Array.isArray(node.examples)) {
        throw new Error(
          `Property "examples" must be an array but got type ${typeof node.examples}.`
        );
      }

      node.examples.push(node.example);
      this.update(node);
    }

    if (this.key && keysToRemove.has(this.key)) {
      this.remove();
    }
  });
}

export function addExampleToSchema(
  schema: ThymianSchema,
  example: unknown
): ThymianSchema {
  if (isRecord(schema) && typeof example !== 'undefined') {
    (schema.examples ??= []).push(example);
  }

  return schema;
}
