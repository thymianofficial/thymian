import type { ThymianSchemaVisitor } from './schema.visitor.js';
import { ThymianSchema } from './thymian.schema.js';

// corresponds to an empty JSON json-schema, that accepts any valid JSON
export class EmptySchema extends ThymianSchema {
  override isNullable(): boolean {
    return true;
  }

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitEmptySchema(this, ...args);
  }
}
