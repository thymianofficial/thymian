import type { ThymianSchemaVisitor } from '../schema.visitor.js';
import { PrimitiveSchema } from './primitive.schema.js';

export class NullSchema extends PrimitiveSchema<null> {
  override type = 'null';

  override accept(visitor: ThymianSchemaVisitor) {
    visitor.visitNullSchema(this);
  }
}
