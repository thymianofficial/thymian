import type {
  ArraySchema,
  BooleanSchema,
  EmptySchema,
  IfThenElseSchema,
  IntegerSchema,
  MultiTypeSchema,
  NullSchema,
  NumberSchema,
  ObjectSchema,
  StringSchema,
  ThymianSchema,
  ThymianSchemaVisitor,
} from '@thymian/core';

export class SchemaDataGenerator implements ThymianSchemaVisitor {
  constructor(private value: unknown) {}

  visitThymianSchema(schema: ThymianSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitObjectSchema(schema: ObjectSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitMultiTypeSchema(schema: MultiTypeSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitEmptySchema(schema: EmptySchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitArraySchema(schema: ArraySchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitBooleanSchema(schema: BooleanSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitIntegerSchema(schema: IntegerSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitNullSchema(schema: NullSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
  visitNumberSchema(schema: NumberSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }

  visitStringSchema(schema: StringSchema, ...args: unknown[]): void {
    if (schema.const) {
      this.value = schema.const;
    }

    if (schema.examples?.length) {
      this.value = schema.examples[0];
    }

    if (schema.enum?.length) {
      this.value = schema.enum[0];
    }
  }

  visitIfThenElseSchema(schema: IfThenElseSchema, ...args: unknown[]): void {
    throw new Error('Method not implemented.');
  }
}
