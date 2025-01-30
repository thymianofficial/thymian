import { ThymianSchema } from './thymian.schema.js';

export * from './array.schema.js';
export * from './empty.schema.js';
export * from './if-then-else.schema.js';
export * from './multi-type.schema.js';
export * from './object.schema.js';
export * from './primitives/index.js';
export * from './schema.visitor.js';
export * from './thymian.schema.js';

export function isThymianSchema(value: unknown): value is ThymianSchema {
  return typeof value === 'object' && value instanceof ThymianSchema;
}
