import { ThymianSchema } from '../thymian.schema.js';

export abstract class PrimitiveSchema<
  T extends string | number | boolean | null = string | number | boolean | null
> extends ThymianSchema {
  abstract type: string;

  declare examples?: T[];

  declare const?: T;

  declare enum?: T[];

  override withExample(example?: T): this {
    return super.withExample(example);
  }

  override withExamples(examples?: T[]): this {
    return super.withExamples(examples);
  }
}
