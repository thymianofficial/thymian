import type { ThymianSchemaVisitor } from '../schema.visitor.js';
import { PrimitiveSchema } from './primitive.schema.js';

export type StringFormat = 'date-time' | 'email' | string; // ...

export class StringSchema extends PrimitiveSchema<string> {
  override type = 'string';

  format?: StringFormat;

  maxLength?: number;

  minLength?: number;

  pattern?: string;

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitStringSchema(this, ...args);
  }

  public matches(value: string): boolean {
    if (!this.pattern) {
      return false;
    }

    return new RegExp(this.pattern).test(value);
  }

  withFormat(value?: StringFormat): this {
    if (value) {
      this.format = value;
    }
    return this;
  }

  withMaxLength(value?: number): this {
    if (value) {
      this.maxLength = value;
    }
    return this;
  }

  withMinLength(value?: number): this {
    if (value) {
      this.minLength = value;
    }
    return this;
  }

  withPattern(value?: string): this {
    if (value) {
      this.pattern = value;
    }
    return this;
  }
}
