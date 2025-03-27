import type { ThymianSchemaVisitor } from '../schema.visitor.js';
import { PrimitiveSchema } from './primitive.schema.js';

export class NumberSchema extends PrimitiveSchema<number> {
  override type = 'number';

  multipleOf?: number;

  maximum?: number;

  exclusiveMaximum?: number;

  minimum?: number;

  exclusiveMinimum?: number;

  format?: string;

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitNumberSchema(this, ...args);
  }

  withMaximum(value?: number, exclusive = false): this {
    if (typeof value === 'number') {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      exclusive ? (this.exclusiveMaximum = value) : (this.maximum = value);
    }
    return this;
  }

  withMultipleOf(value?: number): this {
    if (typeof value === 'number') {
      this.multipleOf = value;
    }
    return this;
  }

  withExclusiveMaximum(value?: number): this {
    if (typeof value === 'number') {
      this.exclusiveMaximum = value;
    }
    return this;
  }

  withMinimum(value?: number, exclusive = false): this {
    if (typeof value === 'number') {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      exclusive ? (this.exclusiveMinimum = value) : (this.minimum = value);
    }
    return this;
  }

  witheExclusiveMinimum(value?: number): this {
    if (typeof value === 'number') {
      this.exclusiveMinimum = value;
    }
    return this;
  }

  withFormat(format?: string): this {
    if (typeof format === 'string') {
      this.format = format;
    }
    return this;
  }
}
