// Currently we use the subset of RFC 6570 OpenAPI 3.x is using which is currently fine. It would be a great feature to implement RFC 6570 completely
export class SerializationStyle<
  Style extends
    | 'matrix'
    | 'label'
    | 'form'
    | 'simple'
    | 'spaceDelimited'
    | 'pipeDelimited'
    | 'deepObject' =
    | 'matrix'
    | 'label'
    | 'form'
    | 'simple'
    | 'spaceDelimited'
    | 'pipeDelimited'
    | 'deepObject'
> {
  explode: boolean;

  style: Style;

  constructor(style: Style, explode: boolean) {
    this.style = style;
    this.explode = explode;
  }

  withExplode(explode?: boolean): this {
    if (typeof explode === 'boolean') {
      this.explode = explode;
    }
    return this;
  }

  withStyle(style?: Style | string): this {
    if (typeof style === 'string') {
      this.style = style as Style;
    }
    return this;
  }
}
