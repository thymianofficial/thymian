import { parseTemplate, type PrimitiveValue } from 'url-template';

import type { SerializationStyle } from '../index.js';

export function serializePathParameter(
  name: string,
  content: unknown,
  serializationStyle: SerializationStyle,
): string {
  let prefix = '';

  if (serializationStyle.style === 'label') {
    prefix = '.';
  } else if (serializationStyle.style === 'matrix') {
    prefix = ';';
  }

  const postfix = serializationStyle.explode ? '*' : '';

  const template = `{${prefix}${name}${postfix}}`;

  return parseTemplate(template).expand({ [name]: content as PrimitiveValue });
}

export function serializeHeaderParameter(
  name: string,
  content: unknown,
  serializationStyle: SerializationStyle,
): string {
  const postfix = serializationStyle.explode ? '*' : '';

  const template = `{${name}${postfix}}`;

  return parseTemplate(template).expand({ [name]: content as PrimitiveValue });
}

export function serializeCookieParameter(
  name: string,
  content: unknown,
): string {
  return parseTemplate(`{${name}}`).expand({
    [name]: content as PrimitiveValue,
  });
}

export function serializeQueryParameter(
  name: string,
  content: unknown,
  serializationStyle: SerializationStyle,
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
      true: `{?${name}*}`,
      false: `{?${name}}`,
    },
    spaceDelimited: {
      true: `{?${name}*}`,
    },
    pipeDelimited: {
      true: `{?${name}*}`,
    },
    deepObject: {},
  };

  const { style, explode } = serializationStyle;
  const template =
    queryParameterTemplates[style]?.[String(explode) as 'true' | 'false'];

  if (typeof template === 'undefined') {
    throw new Error(
      `Serialization with style "${style}" and explode "${explode}" is currently not supported.`,
    );
  }

  return parseTemplate(template)
    .expand({ [name]: content as PrimitiveValue })
    .replace('?', '');
}
