import { ArraySchema } from './array.schema.js';
import { IfThenElseSchema } from './if-then-else.schema.js';
import { ObjectSchema } from './object.schema.js';
import { NullSchema, PrimitiveSchema } from './primitives/index.js';
import type { ThymianSchemaVisitor } from './schema.visitor.js';
import { ThymianSchema } from './thymian.schema.js';

export const hasTypeProperty = (
  schema: ThymianSchema
): schema is PrimitiveSchema | ObjectSchema | ArraySchema => 'type' in schema;

export class MultiTypeSchema extends ThymianSchema {
  constructor() {
    super();
  }

  readonly schemas: ThymianSchema[] = [];

  ifThenElse?: IfThenElseSchema;

  type?: unknown[];

  override accept(visitor: ThymianSchemaVisitor, ...args: unknown[]) {
    visitor.visitMultiTypeSchema(this, ...args);
  }

  nullable(bool = true): this {
    if (bool) {
      this.withSchema(new NullSchema());
    }
    return this;
  }

  override isNullable(): boolean {
    return this.schemas.some(
      (schema) => 'type' in schema && schema.type === 'null'
    );
  }

  withIf(schema?: IfThenElseSchema): this {
    if (typeof schema !== 'undefined') {
      this.ifThenElse = schema;
    }
    return this;
  }

  withType(...type: unknown[]): this {
    if (Array.isArray(type) && type.length > 0) {
      this.type = type;
    }
    return this;
  }

  withSchema(schema: ThymianSchema): this {
    if (hasTypeProperty(schema)) {
      if (!Array.isArray(this.type)) {
        this.type = [];
      }

      this.type.push(schema.type);
    }

    this.schemas.push(schema);
    return this;
  }

  private toJSON() {
    const typeObj =
      Array.isArray(this.type) && this.type.length > 0
        ? { type: Array.from(new Set(this.type)) }
        : {};

    return Object.assign(
      {
        if: this.ifThenElse?.if,
        then: this.ifThenElse?.then,
        else: this.ifThenElse?.else,
        oneOf: this.oneOf,
        allOf: this.allOf,
        anyOf: this.anyOf,
        not: this.not,
        enum: this.enum,
        examples: this.examples,
        dependentSchemas: this.dependentSchemas,
        dependentRequired: this.dependentRequired,
      },
      ...this.schemas,
      typeObj
    );
  }
}
