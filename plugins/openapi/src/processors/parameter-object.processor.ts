import {
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
import type { Parameters } from './utils.js';

export function processParameterObjects(
  parameterObjects: OpenApiV31.ParameterObject[] | undefined
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
    const [name, param] = processParameterObject(parameterObject);

    if (parameterObject.in === 'query') {
      parameters.queryParameters[name] = param;
    } else if (parameterObject.in === 'path') {
      parameters.pathParameters[name] = param;
    } else if (parameterObject.in === 'cookie') {
      parameters.cookies[name] = param;
    } else if (parameterObject.in === 'header') {
      parameters.headers[name] = param;
    }
  }

  return parameters;
}

export function processParameterObject(
  parameterObject: OpenApiV31.ParameterObject
): [string, Parameter] {
  let thymianSchema: ThymianSchema;

  if (parameterObject.schema) {
    thymianSchema = processSchema(
      parameterObject.schema as Draft202012SchemaObject
    );
  } else if (parameterObject.content) {
    const entries = Object.entries(parameterObject.content);

    if (entries.length !== 1) {
      throw new Error('ParameterObject.content MUST contain one entry.');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mediaType = entries[0]![0];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mediaTypeObject = entries[0]![1];

    const isMultipart = /^multipart\/.*/i.test(mediaType);
    const addEncoding =
      mediaType === 'application/x-www-form-urlencoded' || isMultipart;

    const { schema } = processMediaTypeObject(
      mediaTypeObject,
      addEncoding,
      isMultipart
    );

    thymianSchema = schema;
  } else {
    throw new Error(
      'A parameter object must define either a schema or a content property.'
    );
  }

  addExampleToSchema(thymianSchema, parameterObject.example);

  Object.values(parameterObject.examples ?? {}).forEach((example) => {
    addExampleToSchema(
      thymianSchema,
      (example as OpenApiV31.ExampleObject).value
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

  return [
    parameterObject.name,
    typeof parameterObject.description !== 'undefined'
      ? {
          description: parameterObject.description,
          required: parameterObject.required ?? false,
          schema: thymianSchema,
          style,
        }
      : {
          required: parameterObject.required ?? false,
          schema: thymianSchema,
          style,
        },
  ];
}
