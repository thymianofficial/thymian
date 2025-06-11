// Currently we use the subset of RFC 6570 OpenAPI 3.x is using which is currently fine. It would be a great feature to implement RFC 6570 completely
export type Style =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';

export interface SerializationStyle {
  explode: boolean;

  style: Style;
}

export class SerializationStyleBuilder<T extends Style = Style> {
  readonly #result: SerializationStyle;

  constructor(style?: T, explode?: boolean) {
    this.#result = {
      style: style ?? ('form' as T),
      explode: explode ?? false,
    };
  }

  withExplode(explode?: boolean): this {
    if (typeof explode === 'boolean') {
      this.#result.explode = explode;
    }
    return this;
  }

  withStyle(style?: T | string): this {
    if (typeof style === 'string') {
      this.#result.style = style as T;
    }
    return this;
  }

  build(): SerializationStyle {
    return this.#result;
  }
}
