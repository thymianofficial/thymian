// import {
//   type ArraySchema,
//   type BooleanSchema,
//   type IfThenElseSchema,
//   type IntegerSchema,
//   isThymianSchema,
//   type MultiTypeSchema,
//   type NumberSchema,
//   type ObjectSchema,
//   type PrimitiveSchema,
//   QuerySerializationStyle,
//   SerializationStyle,
//   type StringSchema,
//   type ThymianSchema,
//   type ThymianSchemaVisitor,
// } from '@thymian/core';
// import type { OpenAPIV3, OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';
//
// type EncodingObject = OpenAPIV3.EncodingObject | OpenAPIV31.EncodingObject;
//
// export class SerializationStyleVisitor implements ThymianSchemaVisitor {
//   constructor(private readonly encodings: Record<string, EncodingObject>) {}
//
//   visitThymianSchema(schema: ThymianSchema, propertyName?: string): void {
//     schema.allOf?.forEach((schema) => schema.accept(this, propertyName));
//
//     schema.oneOf?.forEach((schema) => schema.accept(this, propertyName));
//
//     schema.anyOf?.forEach((schema) => schema.accept(this, propertyName));
//
//     schema.not?.accept(this, propertyName);
//
//     Object.values(schema.dependentSchemas ?? {}).forEach((propertySchema) =>
//       propertySchema.accept(this, propertySchema)
//     );
//   }
//
//   visitObjectSchema(schema: ObjectSchema, propertyName?: string): void {
//     if (typeof propertyName === 'string') {
//       schema.withSerializationStyle(this.getSerializationStyle(propertyName));
//     }
//
//     for (const [key, value] of Object.entries(schema.properties ?? {})) {
//       value.accept(this, key);
//     }
//
//     if (isThymianSchema(schema.additionalProperties)) {
//       schema.additionalProperties.accept(this, propertyName);
//     }
//
//     Object.values(schema.patternProperties ?? {}).forEach((propertySchema) =>
//       propertySchema.accept(this, propertySchema)
//     );
//
//     this.visitThymianSchema(schema, propertyName);
//   }
//
//   visitMultiTypeSchema(schema: MultiTypeSchema, propertyName: string): void {
//     schema.schemas.forEach((s) => s.accept(this, propertyName));
//
//     schema.ifThenElse?.accept(this, propertyName);
//
//     this.visitThymianSchema(schema, propertyName);
//   }
//
//   visitArraySchema(schema: ArraySchema, propertyName: string): void {
//     if (isThymianSchema(schema.items)) {
//       schema.items.accept(this, propertyName);
//     }
//
//     schema.contains?.accept(this, propertyName);
//
//     schema.prefixItems?.forEach((s) => s.accept(this, propertyName));
//
//     this.visitThymianSchema(schema, propertyName);
//   }
//
//   visitIfThenElseSchema(schema: IfThenElseSchema, propertyName: string): void {
//     schema.if.accept(this, propertyName);
//
//     schema.else?.accept(this, propertyName);
//
//     schema.then?.accept(this, propertyName);
//   }
//
//   visitBooleanSchema(schema: BooleanSchema, propertyName?: string): void {
//     this.visitPrimitiveSchema(schema, propertyName);
//   }
//
//   visitIntegerSchema(schema: IntegerSchema, propertyName?: string): void {
//     this.visitPrimitiveSchema(schema, propertyName);
//   }
//
//   visitNumberSchema(schema: NumberSchema, propertyName?: string): void {
//     this.visitPrimitiveSchema(schema, propertyName);
//   }
//
//   visitStringSchema(schema: StringSchema, propertyName?: string): void {
//     this.visitPrimitiveSchema(schema, propertyName);
//   }
//
//   // eslint-disable-next-line @typescript-eslint/no-empty-function
//   visitEmptySchema(): void {}
//
//   // eslint-disable-next-line @typescript-eslint/no-empty-function
//   visitNullSchema(): void {}
//
//   private visitPrimitiveSchema(
//     schema: PrimitiveSchema,
//     propertyName?: string
//   ): void {
//     const style = this.getSerializationStyle(propertyName);
//
//     schema.withSerializationStyle(style);
//   }
//
//   private getSerializationStyle(
//     propertyName: string | undefined
//   ): SerializationStyle {
//     if (typeof propertyName !== 'string') {
//       return new QuerySerializationStyle();
//     }
//
//     const style = this.encodings[propertyName]?.style ?? 'form';
//     const explode = this.encodings[propertyName]?.explode ?? style === 'form';
//
//     return new SerializationStyle(
//       style as SerializationStyle['style'],
//       explode
//     );
//   }
// }
