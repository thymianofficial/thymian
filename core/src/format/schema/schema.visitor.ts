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

export interface ThymianSchemaVisitor<T = void> {
  visitThymianSchema(schema: ThymianSchema, ...args: unknown[]): T;

  visitObjectSchema(schema: ObjectSchema, ...args: unknown[]): T;

  visitMultiTypeSchema(schema: MultiTypeSchema, ...args: unknown[]): T;

  visitEmptySchema(schema: EmptySchema, ...args: unknown[]): T;

  visitArraySchema(schema: ArraySchema, ...args: unknown[]): T;

  visitBooleanSchema(schema: BooleanSchema, ...args: unknown[]): T;

  visitIntegerSchema(schema: IntegerSchema, ...args: unknown[]): T;

  visitNullSchema(schema: NullSchema, ...args: unknown[]): T;

  visitNumberSchema(schema: NumberSchema, ...args: unknown[]): T;

  visitStringSchema(schema: StringSchema, ...args: unknown[]): T;

  visitIfThenElseSchema(schema: IfThenElseSchema, ...args: unknown[]): T;
}
