import type { OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';
import {
  ArraySchema,
  BooleanSchema,
  IntegerSchema,
  MultiTypeSchema,
  NullSchema,
  NumberSchema,
  ObjectSchema,
  StringSchema,
  ThymianSchema,
} from '@thymian/core';

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
  if (Array.isArray(schema.type)) {
    const baseSchema = new MultiTypeSchema();

    schema.type.forEach((type) => {
      baseSchema.withSchema(
        processSchema({
          ...schema,
          type,
        } as Draft202012SchemaObject)
      );
    });

    return baseSchema;
  } else {
    let baseSchema: ThymianSchema;

    switch (schema.type) {
      case 'null':
        baseSchema = new NullSchema();
        break;
      case 'boolean':
        baseSchema = new BooleanSchema();
        break;
      case 'string':
        baseSchema = createStringSchema(schema);
        break;
      case 'object':
        baseSchema = createObjectSchema(schema);
        break;
      case 'integer':
        baseSchema = createIntegerSchema(schema);
        break;
      case 'number':
        baseSchema = createNumberSchema(schema);
        break;
      case 'array':
        baseSchema = createArraySchema(schema);
        break;
      default:
        baseSchema = new MultiTypeSchema();

        if (isStringSchema(schema)) {
          (baseSchema as MultiTypeSchema).withSchema(
            createStringSchema(schema)
          );
        }

        if (isNumberSchema(schema)) {
          (baseSchema as MultiTypeSchema).withSchema(
            createNumberSchema(schema)
          );
        }

        if (isObjectSchema(schema)) {
          (baseSchema as MultiTypeSchema).withSchema(
            createObjectSchema(schema)
          );
        }

        if (isArraySchema(schema)) {
          (baseSchema as MultiTypeSchema).withSchema(createArraySchema(schema));
        }

        if ((baseSchema as MultiTypeSchema).schemas.length === 0) {
          baseSchema = new ThymianSchema();
        } else if ((baseSchema as MultiTypeSchema).schemas.length === 1) {
          baseSchema = (baseSchema as MultiTypeSchema)
            .schemas[0] as ThymianSchema;
        }
    }

    return baseSchema
      .withExample(schema.example)
      .withExamples(schema.examples)
      .withEnumValues(schema.enum)
      .withDefault(schema.default)
      .withConst(schema.const)
      .withContentMediaType(schema.contentMediaType)
      .withContentEncoding(schema.contentEncoding)
      .withAllOf(
        schema.allOf?.map((o) => processSchema(o as Draft202012SchemaObject))
      )
      .withOneOf(
        schema.oneOf?.map((o) => processSchema(o as Draft202012SchemaObject))
      )
      .withAnyOf(
        schema.anyOf?.map((o) => processSchema(o as Draft202012SchemaObject))
      )
      .withNot(
        schema.not
          ? processSchema(schema.not as Draft202012SchemaObject)
          : undefined
      );
  }
}

export function isStringSchema(schema: Draft202012SchemaObject): boolean {
  return ['minLength', 'maxLength', 'pattern'].some((key) => key in schema);
}

export function createStringSchema(
  schema: Draft202012SchemaObject
): StringSchema {
  return new StringSchema()
    .withMinLength(schema.minLength)
    .withMaxLength(schema.maxLength)
    .withPattern(schema.pattern)
    .withFormat(schema.format);
}

export function isNumberSchema(schema: Draft202012SchemaObject): boolean {
  return [
    'multipleOf',
    'maximum',
    'minimum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ].some((key) => key in schema);
}

export function createNumberSchema(
  schema: Draft202012SchemaObject
): NumberSchema {
  return new NumberSchema()
    .withMultipleOf(schema.multipleOf)
    .withFormat(schema.format)
    .withMaximum(schema.maximum)
    .withMinimum(schema.minimum)
    .withExclusiveMaximum(schema.exclusiveMaximum)
    .witheExclusiveMinimum(schema.exclusiveMinimum);
}

export function createIntegerSchema(
  schema: Draft202012SchemaObject
): IntegerSchema {
  return new IntegerSchema()
    .withMultipleOf(schema.multipleOf)
    .withFormat(schema.format)
    .withMaximum(schema.maximum)
    .withMinimum(schema.minimum)
    .withExclusiveMaximum(schema.exclusiveMaximum)
    .witheExclusiveMinimum(schema.exclusiveMinimum);
}

export function isObjectSchema(schema: Draft202012SchemaObject): boolean {
  return [
    'properties',
    'patternProperties',
    'required',
    'additionalProperties',
    'minProperties',
    'maxProperties',
    'unevaluatedProperties',
  ].some((key) => key in schema);
}

export function createObjectSchema(
  schema: Draft202012SchemaObject
): ObjectSchema {
  const objSchema = new ObjectSchema()
    .withMaxProperties(schema.maxProperties)
    .withMinProperties(schema.minProperties)
    .allowUnevaluatedProperties(schema.unevaluatedProperties)
    .withAdditionalProperties(
      typeof schema.additionalProperties === 'boolean'
        ? schema.additionalProperties
        : typeof schema.additionalProperties !== 'undefined'
        ? processSchema(schema.additionalProperties as Draft202012SchemaObject)
        : undefined
    );

  const requiredProperties = new Set(schema.required ?? []);

  Object.entries(schema.properties ?? {}).forEach(([name, schema]) => {
    objSchema.withProperty(
      name,
      processSchema(schema as Draft202012SchemaObject),
      requiredProperties.has(name)
    );
  });

  Object.entries(schema.patternProperties ?? {}).forEach(
    ([pattern, schema]) => {
      objSchema.withPatternProperty(
        pattern,
        processSchema(schema as Draft202012SchemaObject)
      );
    }
  );

  return objSchema;
}

export function createArraySchema(
  schema: Draft202012SchemaObject
): ArraySchema {
  return new ArraySchema()
    .withMaxItems(schema.maxItems)
    .withMinItems(schema.minItems)
    .unique(schema.uniqueItems)
    .withContains(schema.contains ? processSchema(schema.contains) : undefined)
    .allowUnevaluatedItems(schema.unevaluatedItems)
    .withMinContains(schema.minContains)
    .withMaxContains(schema.maxContains)
    .withPrefixItems(schema.prefixItems?.map((s) => processSchema(s)))
    .withItems(
      'items' in schema
        ? processSchema(schema.items as Draft202012SchemaObject)
        : undefined
    );
}

export function isArraySchema(schema: Draft202012SchemaObject): boolean {
  return [
    'items',
    'maxItems',
    'uniqueItems',
    'minItems',
    'contains',
    'unevaluatedItems',
    'minContains',
    'maxContains',
    'prefixItems',
  ].some((key) => key in schema);
}
