import { isRecord, type ThymianSchema } from '@thymian/core';
import type { OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';
import traverse from 'traverse';

const keysToRemove = new Set([
  'nullable',
  'example',
  'deprecated',
  'discriminator',
  'xml',
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
};

export function processSchema(schema: Draft202012SchemaObject): ThymianSchema {
  return traverse(schema).map(function (node) {
    if (!this.isLeaf && isRecord(node) && node['example']) {
      node.examples ??= [];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
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
