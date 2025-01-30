import type { ThymianSchemaVisitor } from '../schema.visitor.js';
import { PrimitiveSchema } from './primitive.schema.js';

export class BooleanSchema extends PrimitiveSchema<boolean> {
  override type = 'boolean';

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitBooleanSchema(this, ...args);
  }
}
