import type { ThymianSchemaVisitor } from './schema.visitor.js';
import { ThymianSchema } from './thymian.schema.js';

export class ObjectSchema extends ThymianSchema {
  readonly type = 'object';

  properties?: Record<string, ThymianSchema>;

  patternProperties?: Record<string, ThymianSchema>;

  required?: string[];

  additionalProperties?: boolean | ThymianSchema;

  minProperties?: number;

  maxProperties?: number;

  unevaluatedProperties?: boolean;

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitObjectSchema(this, ...args);
  }

  allowUnevaluatedProperties(allow?: boolean): this {
    if (typeof allow === 'boolean') {
      this.unevaluatedProperties = allow;
    }

    return this;
  }

  withAdditionalProperties(value?: boolean | ThymianSchema): this {
    if (typeof value !== 'undefined') {
      this.additionalProperties = value;
    }
    return this;
  }

  withProperty(name: string, schema: ThymianSchema, required = false): this {
    if (required) {
      return this.withRequiredProperty(name, schema);
    } else if (!this.properties) {
      this.properties = {};
    }

    this.properties[name] = schema;

    return this;
  }

  withRequiredProperty(name: string, schema: ThymianSchema): this {
    if (!this.required) {
      this.required = [];
    }

    this.required.push(name);

    return this.withProperty(name, schema);
  }

  withPatternProperty(pattern: string, schema: ThymianSchema): this {
    if (!this.patternProperties) {
      this.patternProperties = {};
    }

    this.patternProperties[pattern] = schema;

    return this;
  }

  withMinProperties(value?: number): this {
    if (typeof value === 'number') {
      this.minProperties = value;
    }
    return this;
  }

  withMaxProperties(value?: number): this {
    if (typeof value === 'number') {
      this.maxProperties = value;
    }
    return this;
  }
}
