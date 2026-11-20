import {
  type HttpResponse,
  serializeBody,
  serializeHeaderParameter,
  type ThymianHttpResponse,
  type ThymianSchema,
} from '@thymian/core';

/**
 * The response that answers a transaction exactly as the format declares it:
 * the declared status, every declared header (required or not) with a value,
 * the declared media type as `content-type`, and a body where the format
 * declares a schema for one.
 */
export function conformingResponse(
  declared: ThymianHttpResponse,
): HttpResponse {
  const headers: HttpResponse['headers'] = {};

  for (const [name, { schema, style }] of Object.entries(declared.headers)) {
    const value = valueOf(schema);

    headers[name.toLowerCase()] =
      typeof value === 'string'
        ? value
        : serializeHeaderParameter(name, value, style);
  }

  if (declared.mediaType !== '') {
    headers['content-type'] = declared.mediaType;
  }

  const body =
    declared.schema === undefined
      ? undefined
      : serializeBody(valueOf(declared.schema));

  return {
    statusCode: declared.statusCode,
    headers,
    ...(body === undefined ? {} : { body }),
    trailers: {},
    duration: 0,
  };
}

/**
 * A value of the schema: the one the schema names (its first example, its
 * constant, its first enum member or its default), else the plainest value of
 * its type.
 */
function valueOf(schema: ThymianSchema): unknown {
  const named = [
    schema.examples?.[0],
    schema.const,
    schema.enum?.[0],
    schema.default,
  ].find((value) => value !== undefined);

  if (named !== undefined) {
    return named;
  }

  switch (Array.isArray(schema.type) ? schema.type[0] : schema.type) {
    case 'object':
      return {};
    case 'array':
      return [];
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return 'string';
  }
}
