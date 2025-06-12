import {
  type Encoding,
  type Parameter,
  type SerializationStyle,
  SerializationStyleBuilder,
  type ThymianSchema,
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { processHeadersObject } from './headers-object.processor.js';
import {
  addExampleToSchema,
  type Draft202012SchemaObject,
  processSchema,
} from './json-schema.processor.js';

export function extractSerializationStyle(
  encodingObj: OpenApiV31.EncodingObject
): SerializationStyle {
  const style = encodingObj.style ?? 'form';
  const explode = encodingObj.explode ?? style === 'form';

  return new SerializationStyleBuilder(
    style as SerializationStyle['style'],
    explode
  ).build();
}

export function processMediaTypeObject(
  mediaTypeObject: OpenApiV31.MediaTypeObject,
  addEncodings = false,
  isMultipart = false
): {
  schema: ThymianSchema;
  headers: Record<string, Parameter>;
  encoding?: Encoding;
} {
  const schema = mediaTypeObject.schema
    ? processSchema(mediaTypeObject.schema as Draft202012SchemaObject)
    : ({} as ThymianSchema);

  Object.values(mediaTypeObject.examples ?? {}).forEach((example) => {
    addExampleToSchema(schema, (example as OpenApiV31.ExampleObject).value);
  });

  let headers: Record<string, Parameter> = {};
  if (isMultipart && mediaTypeObject.encoding) {
    Object.values(mediaTypeObject.encoding).forEach((encodingObject) => {
      headers = processHeadersObject(
        encodingObject.headers as Record<string, OpenApiV31.HeaderObject>
      );
    });
  }

  addExampleToSchema(schema, mediaTypeObject.example);

  const result: {
    schema: ThymianSchema;
    headers: Record<string, Parameter>;
    encoding?: Encoding;
  } = {
    headers,
    schema,
  };

  if (addEncodings) {
    result.encoding = Object.entries(mediaTypeObject.encoding ?? {}).reduce(
      (acc, [propertyName, encodingObj]) => ({
        ...acc,
        [propertyName]: {
          contentType: encodingObj.contentType,
          headers: processHeadersObject(
            encodingObj.headers as Record<string, OpenApiV31.HeaderObject>
          ),
          serializationStyle: extractSerializationStyle(encodingObj),
        },
      }),
      {} as Encoding
    );
  }

  return result;
}
