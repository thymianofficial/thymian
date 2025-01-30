import type { ThymianSchemaVisitor } from './schema.visitor.js';
import { SerializationStyle } from '../serialization-style/index.js';

export class ThymianSchema {
  allOf?: ThymianSchema[];

  anyOf?: ThymianSchema[];

  oneOf?: ThymianSchema[];

  not?: ThymianSchema;

  examples?: unknown[];

  enum?: unknown[];

  const?: unknown;

  dependentSchemas?: Record<string, ThymianSchema>;

  dependentRequired?: Record<string, string[]>;

  contentMediaType?: string;

  contentEncoding?: string;

  serializationStyle?: SerializationStyle;

  isEmpty(): boolean {
    return Object.keys(this).length === 0;
  }

  withSerializationStyle(style: SerializationStyle): this {
    if (style) {
      this.serializationStyle = style;
    }

    return this;
  }

  withContentMediaType(value?: string): this {
    if (value) {
      this.contentMediaType = value;
    }
    return this;
  }

  withContentEncoding(value?: string): this {
    if (value) {
      this.contentEncoding = value;
    }
    return this;
  }

  accept(visitor: ThymianSchemaVisitor, ...args: unknown[]): void {
    visitor.visitThymianSchema(this, ...args);
  }

  withConst(constVal: unknown): this {
    if (typeof constVal !== 'undefined') {
      this.const = constVal;
    }

    return this;
  }

  withEnum(value?: unknown): this {
    if (typeof value !== 'undefined') {
      if (!this.enum) {
        this.enum = [];
      }

      this.enum.push(value);
    }

    return this;
  }

  withEnumValues(values?: unknown[]): this {
    if (Array.isArray(values)) {
      if (!this.enum) {
        this.enum = [];
      }

      this.enum.push(...values);
    }

    return this;
  }

  withExample(value?: unknown): this {
    if (typeof value !== 'undefined') {
      if (!this.examples) {
        this.examples = [];
      }

      this.examples.push(value);
    }

    return this;
  }

  withExamples(values?: unknown[]): this {
    if (Array.isArray(values) && values.length > 0) {
      if (!this.examples) {
        this.examples = [];
      }

      this.examples.push(...values);
    }

    return this;
  }

  withAllOf(schemas?: ThymianSchema[]): this {
    if (Array.isArray(schemas)) {
      this.allOf = schemas;
    }
    return this;
  }

  withAnyOf(schemas?: ThymianSchema[]): this {
    if (Array.isArray(schemas)) {
      this.anyOf = schemas;
    }
    return this;
  }

  withOneOf(schemas?: ThymianSchema[]): this {
    if (Array.isArray(schemas) && schemas.length > 0) {
      this.oneOf = schemas;
    }
    return this;
  }

  withNot(schema?: ThymianSchema): this {
    if (typeof schema !== 'undefined') {
      this.not = schema;
    }
    return this;
  }

  withDependentSchema(name: string, schema: ThymianSchema): this {
    if (!this.dependentSchemas) {
      this.dependentSchemas = {};
    }

    this.dependentSchemas[name] = schema;

    return this;
  }

  withDependantRequired(name: string, required: string[]): this {
    if (!this.dependentRequired) {
      this.dependentRequired = {};
    }

    this.dependentRequired[name] = required;

    return this;
  }

  isNullable(): boolean {
    return false;
  }
}
