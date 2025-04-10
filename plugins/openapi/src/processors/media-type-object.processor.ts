import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { EmptySchema, type Parameter, ThymianSchema } from '@thymian/core';
import { EncodingVisitor } from '../visitors/encoding.visitor.js';
import { SerializationStyleVisitor } from '../visitors/serialization-style.visitor.js';
import { processHeadersObject } from './headers-object.processor.js';
import {
  type Draft202012SchemaObject,
  processSchema,
} from './json-schema.processor.js';

export function processMediaTypeObject(
  mediaTypeObject: OpenApiV31.MediaTypeObject,
  addEncodings = false,
  isMultipart = false
): { schema: ThymianSchema; headers: Record<string, Parameter> } {
  const schema = mediaTypeObject.schema
    ? processSchema(mediaTypeObject.schema as Draft202012SchemaObject)
    : new EmptySchema();

  Object.values(mediaTypeObject.examples ?? {}).forEach((example) => {
    schema.withExample((example as OpenApiV31.ExampleObject).value);
  });

  if (addEncodings) {
    schema.accept(new EncodingVisitor(mediaTypeObject.encoding ?? {}));
  }

  if (isMultipart) {
    schema.accept(
      new SerializationStyleVisitor(mediaTypeObject.encoding ?? {})
    );
  }

  let headers: Record<string, Parameter> = {};
  if (isMultipart && mediaTypeObject.encoding) {
    Object.values(mediaTypeObject.encoding).forEach((encodingObject) => {
      headers = processHeadersObject(
        encodingObject.headers as Record<string, OpenApiV31.HeaderObject>
      );
    });
  }

  schema.withExample(mediaTypeObject.example);

  return {
    headers,
    schema,
  };
}
