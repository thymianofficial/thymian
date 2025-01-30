import { ThymianSchema } from './thymian.schema.js';

export class IfThenElseSchema extends ThymianSchema {
  if: ThymianSchema;

  then?: ThymianSchema;

  else?: ThymianSchema;

  constructor(ifValue: ThymianSchema) {
    super();
    this.if = ifValue;
  }

  withElse(elseValue?: ThymianSchema): this {
    if (elseValue) {
      this.else = elseValue;
    }

    return this;
  }

  withThen(thenValue?: ThymianSchema): this {
    if (thenValue) {
      this.then = thenValue;
    }

    return this;
  }
}
