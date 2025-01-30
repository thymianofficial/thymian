import type { ThymianSchemaVisitor } from '../schema.visitor.js';
import { NumberSchema } from './number.schema.js';

export class IntegerSchema extends NumberSchema {
  override type = 'integer';

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitIntegerSchema(this, ...args);
  }
}
