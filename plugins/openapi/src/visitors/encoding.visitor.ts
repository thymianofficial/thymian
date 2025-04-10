import {
  type ArraySchema,
  type BooleanSchema,
  type IfThenElseSchema,
  type IntegerSchema,
  isThymianSchema,
  type MultiTypeSchema,
  type NumberSchema,
  type ObjectSchema,
  type PrimitiveSchema,
  type StringSchema,
  type ThymianSchema,
  type ThymianSchemaVisitor,
} from '@thymian/core';
import type { OpenAPIV3, OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';

type EncodingObject = OpenAPIV3.EncodingObject | OpenAPIV31.EncodingObject;

export class EncodingVisitor implements ThymianSchemaVisitor {
  constructor(private readonly encodings: Record<string, EncodingObject>) {}

  visitThymianSchema(schema: ThymianSchema, propertyName?: string): void {
    schema.allOf?.forEach((schema) => schema.accept(this, propertyName));

    schema.oneOf?.forEach((schema) => schema.accept(this, propertyName));

    schema.anyOf?.forEach((schema) => schema.accept(this, propertyName));

    schema.not?.accept(this, propertyName);

    Object.values(schema.dependentSchemas ?? {}).forEach((propertySchema) =>
      propertySchema.accept(this, propertySchema)
    );
  }

  visitObjectSchema(schema: ObjectSchema, propertyName?: string): void {
    const contentType = this.getContentType(propertyName, 'application/json');

    schema.withContentMediaType(contentType);

    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      value.accept(this, key);
    }

    if (isThymianSchema(schema.additionalProperties)) {
      schema.additionalProperties.accept(this, propertyName);
    }

    Object.entries(schema.patternProperties ?? {}).forEach(
      ([prop, propertySchema]) => propertySchema.accept(this, prop)
    );

    this.visitThymianSchema(schema, propertyName);
  }

  visitMultiTypeSchema(schema: MultiTypeSchema, propertyName: string): void {
    schema.schemas.forEach((s) => s.accept(this, propertyName));

    schema.ifThenElse?.accept(this, propertyName);

    this.visitThymianSchema(schema, propertyName);
  }

  visitArraySchema(schema: ArraySchema, propertyName?: string): void {
    if (isThymianSchema(schema.items)) {
      schema.items.accept(this, propertyName);

      schema.withContentMediaType(schema.items.contentMediaType);
    }

    schema.contains?.accept(this, propertyName);

    schema.prefixItems?.forEach((s) => s.accept(this, propertyName));

    this.visitThymianSchema(schema, propertyName);
  }

  visitIfThenElseSchema(
    schema: IfThenElseSchema,
    propertyName: string,
    contentType: string
  ): void {
    schema.if.accept(this, propertyName, contentType);

    schema.else?.accept(this, propertyName, contentType);

    schema.then?.accept(this, propertyName, contentType);
  }

  visitBooleanSchema(schema: BooleanSchema, propertyName?: string): void {
    this.visitPrimitiveSchema(schema, propertyName);
  }

  visitIntegerSchema(schema: IntegerSchema, propertyName?: string): void {
    this.visitPrimitiveSchema(schema, propertyName);
  }

  visitNumberSchema(schema: NumberSchema, propertyName?: string): void {
    this.visitPrimitiveSchema(schema, propertyName);
  }

  visitStringSchema(schema: StringSchema, propertyName?: string): void {
    this.visitPrimitiveSchema(
      schema,
      propertyName,
      schema.format === 'binary' ? 'application/octet-stream' : 'text/plain'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  visitEmptySchema(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  visitNullSchema(): void {}

  private visitPrimitiveSchema(
    schema: PrimitiveSchema,
    propertyName?: string,
    defaultContentType = 'text/plain'
  ): void {
    const contentType = this.getContentType(propertyName, defaultContentType);

    schema.withContentMediaType(contentType);
  }

  private getContentType(
    propertyName: string | undefined,
    defaultContentType: string
  ): string {
    if (typeof propertyName !== 'string') {
      return defaultContentType;
    }

    return Object.hasOwn(this.encodings, propertyName)
      ? this.encodings[propertyName]?.contentType ?? defaultContentType
      : defaultContentType;
  }
}
