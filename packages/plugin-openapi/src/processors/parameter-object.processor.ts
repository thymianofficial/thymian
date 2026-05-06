import {
  capitalizeFirstChar,
  CookieSerializationStyleBuilder,
  HeaderSerializationStyleBuilder,
  type Parameter,
  PathSerializationStyleBuilder,
  QuerySerializationStyleBuilder,
  type ThymianSchema,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import {
  addExampleToSchema,
  type Draft202012SchemaObject,
  processSchema,
} from './json-schema.processor.js';
import { processMediaTypeObject } from './media-type-object.processor.js';
import { resolveOpenApiReference } from './openapi-reference-resolver.js';
import type { Parameters } from './utils.js';

export function processParameterObjects(
  parameterObjects:
    | (OpenApiV31.ParameterObject | OpenApiV31.ReferenceObject)[]
    | undefined,
  document: OpenApiV31.Document,
): Parameters {
  const parameters: Parameters = {
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
  };

  if (!parameterObjects) {
    return parameters;
  }

  for (const parameterObject of parameterObjects) {
    const resolvedParameter =
      resolveOpenApiReference<OpenApiV31.ParameterObject>(
        parameterObject,
        document,
        'parameter',
      );
    const [name, param] = processParameterObject(resolvedParameter, document);

    if (resolvedParameter.in === 'query') {
      parameters.queryParameters[name] = param;
    } else if (resolvedParameter.in === 'path') {
      parameters.pathParameters[name] = param;
    } else if (resolvedParameter.in === 'cookie') {
      parameters.cookies[name] = param;
    } else if (resolvedParameter.in === 'header') {
      parameters.headers[name] = param;
    }
  }

  return parameters;
}

export function processParameterObject(
  parameterObject: OpenApiV31.ParameterObject,
  document: OpenApiV31.Document,
): [string, Parameter] {
  let thymianSchema: ThymianSchema;
  let parameterContentType: string | undefined;

  if (parameterObject.schema) {
    thymianSchema = processSchema(
      parameterObject.schema as Draft202012SchemaObject,
      { document },
    );
  } else if (parameterObject.content) {
    const entries = Object.entries(parameterObject.content);

    if (entries.length !== 1 || !entries[0]) {
      throw new Error(
        'ParameterObject.content MUST contain exactly one entry.',
      );
    }

    const [contentType, mediaTypeObject] = entries[0];

    const isMultipart = /^multipart\/.*/i.test(contentType);
    const addEncoding =
      contentType === 'application/x-www-form-urlencoded' || isMultipart;

    const { schema } = processMediaTypeObject(
      mediaTypeObject,
      document,
      addEncoding,
      isMultipart,
    );

    if (!schema) {
      throw new Error(
        `${capitalizeFirstChar(parameterObject.in)} parameter "${
          parameterObject.name
        }" object must define either a schema or a content property.`,
      );
    }

    thymianSchema = schema;
    parameterContentType = contentType;
  } else {
    throw new Error(
      `${capitalizeFirstChar(parameterObject.in)} parameter "${
        parameterObject.name
      }" object must define either a schema or a content property.`,
    );
  }

  addExampleToSchema(thymianSchema, parameterObject.example);

  Object.values(parameterObject.examples ?? {}).forEach((example) => {
    addExampleToSchema(
      thymianSchema,
      resolveOpenApiReference<OpenApiV31.ExampleObject>(
        example,
        document,
        'example',
      ).value,
    );
  });

  const style =
    parameterObject.in === 'header'
      ? new HeaderSerializationStyleBuilder()
          .withExplode(parameterObject.explode)
          .build()
      : parameterObject.in === 'query'
        ? new QuerySerializationStyleBuilder()
            .withStyle(parameterObject.style)
            .withExplode(parameterObject.explode)
            .build()
        : parameterObject.in === 'path'
          ? new PathSerializationStyleBuilder()
              .withStyle(parameterObject.style)
              .withExplode(parameterObject.explode)
              .build()
          : new CookieSerializationStyleBuilder()
              .withStyle(parameterObject.style)
              .withExplode(parameterObject.explode)
              .build();

  const param: Parameter = {
    required: parameterObject.required ?? false,
    schema: thymianSchema,
    style,
  };

  if (parameterObject.description) {
    param.description = parameterObject.description;
  }

  if (parameterContentType) {
    param.contentType = parameterContentType;
  }

  return [parameterObject.name, param];
}
