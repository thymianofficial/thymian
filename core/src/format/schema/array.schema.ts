import type { ThymianSchemaVisitor } from './schema.visitor.js';
import { ThymianSchema } from './thymian.schema.js';

export class ArraySchema extends ThymianSchema {
  readonly type = 'array';

  items?: ThymianSchema | boolean;

  prefixItems?: ThymianSchema[];

  unevaluatedItems?: boolean;

  contains?: ThymianSchema;

  minContains?: number;

  maxContains?: number;

  minItems?: number;

  maxItems?: number;

  uniqueness?: boolean;

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitArraySchema(this, ...args);
  }

  withItems(items?: ThymianSchema): this {
    if (typeof items !== 'undefined') {
      this.items = items;
    }
    return this;
  }

  withPrefixItems(items?: ThymianSchema[]): this {
    if (Array.isArray(items) && items.length > 0) {
      this.prefixItems = items;
    }

    return this;
  }

  withContains(schema?: ThymianSchema): this {
    if (typeof schema !== 'undefined') {
      this.contains = schema;
    }
    return this;
  }

  withMinContains(num?: number): this {
    if (typeof num === 'number') {
      this.minContains = num;
    }
    return this;
  }

  withMaxContains(num?: number): this {
    if (typeof num === 'number') {
      this.maxContains = num;
    }
    return this;
  }

  withMinItems(num?: number): this {
    if (typeof num === 'number') {
      this.minItems = num;
    }
    return this;
  }

  withMaxItems(num?: number): this {
    if (typeof num === 'number') {
      this.maxItems = num;
    }
    return this;
  }

  public unique(unique?: boolean): this {
    if (typeof unique === 'boolean') {
      this.uniqueness = unique;
    }
    return this;
  }

  public allowUnevaluatedItems(allow?: boolean): this {
    if (typeof allow === 'boolean') {
      this.unevaluatedItems = allow;
    }
    return this;
  }
}
