import { type Parameter, SerializationStyle } from '@thymian/core';
import { parseTemplate, type PrimitiveValue } from 'url-template';

export function serializePathParameter(
  content: unknown,
  parameter: Parameter
): string {
  let prefix = '';

  if (parameter.style.style === 'label') {
    prefix = '.';
  } else if (parameter.style.style === 'matrix') {
    prefix = ';';
  }

  const postfix = parameter.style.explode ? '*' : '';

  const template = `{${prefix}param${postfix}}`;

  return parseTemplate(template).expand({ param: content as PrimitiveValue });
}

export function serializeHeaderParameter(
  content: unknown,
  parameter: Parameter
): string {
  const postfix = parameter.style.explode ? '*' : '';

  const template = `{header${postfix}}`;

  return parseTemplate(template).expand({ header: content as PrimitiveValue });
}

export function serializeCookieParameter(content: unknown): string {
  return parseTemplate('{cookie}').expand({
    cookie: content as PrimitiveValue,
  });
}

export function serializeQueryParameter(
  content: unknown,
  parameter: Parameter,
  prefix: '?' | '&' = '?'
): string {
  // See matrix https://swagger.io/docs/specification/v3_0/serialization/#query-parameters
  const queryParameterTemplates: Record<
    SerializationStyle['style'],
    { true?: string; false?: string }
  > = {
    label: {},
    matrix: {},
    simple: {},
    form: {
      true: `{${prefix}param*}`,
      false: `{?param}`,
    },
    spaceDelimited: {
      true: `{?param*}`,
    },
    pipeDelimited: {
      true: `{?param*}`,
    },
    deepObject: {},
  };

  const { style, explode } = parameter.style;
  const template =
    queryParameterTemplates[style]?.[String(explode) as 'true' | 'false'];

  if (typeof template === 'undefined') {
    throw new Error(
      `Serialization with style "${style}" and explode "${explode}" is currently not supported.`
    );
  }

  return parseTemplate(template)
    .expand({ param: content as PrimitiveValue })
    .replace('?', '');
}
