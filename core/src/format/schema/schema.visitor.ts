import { IfThenElseSchema } from './if-then-else.schema.js';
import type { ThymianSchema } from './thymian.schema.js';
import type { ObjectSchema } from './object.schema.js';
import type { MultiTypeSchema } from './multi-type.schema.js';
import type { EmptySchema } from './empty.schema.js';
import type { ArraySchema } from './array.schema.js';
import {
  BooleanSchema,
  IntegerSchema,
  NullSchema,
  NumberSchema,
  StringSchema,
} from './primitives/index.js';

export interface ThymianSchemaVisitor {
  visitThymianSchema(schema: ThymianSchema, ...args: unknown[]): void;

  visitObjectSchema(schema: ObjectSchema, ...args: unknown[]): void;

  visitMultiTypeSchema(schema: MultiTypeSchema, ...args: unknown[]): void;

  visitEmptySchema(schema: EmptySchema, ...args: unknown[]): void;

  visitArraySchema(schema: ArraySchema, ...args: unknown[]): void;

  visitBooleanSchema(schema: BooleanSchema, ...args: unknown[]): void;

  visitIntegerSchema(schema: IntegerSchema, ...args: unknown[]): void;

  visitNullSchema(schema: NullSchema, ...args: unknown[]): void;

  visitNumberSchema(schema: NumberSchema, ...args: unknown[]): void;

  visitStringSchema(schema: StringSchema, ...args: unknown[]): void;

  visitIfThenElseSchema(schema: IfThenElseSchema, ...args: unknown[]): void;
}
