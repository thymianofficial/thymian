import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { EmptySchema, type ThymianHttpRequest } from '@thymian/core';
import { processMediaTypeObject } from './media-type-object.processor.js';
import type { Parameters } from './utils.js';

export function processRequestBodyObjet(
  requestBodyObject: OpenApiV31.RequestBodyObject | undefined,
  parameters: Parameters,
  context: {
    path: string;
    operationId?: string;
    method: string;
    host: string;
    port: number;
    protocol: 'http' | 'https';
  }
): ThymianHttpRequest[] {
  if (!requestBodyObject) {
    return [
      {
        type: 'http-request',
        host: context.host,
        port: context.port,
        protocol: context.protocol,
        path: context.path,
        method: context.method,
        bodyRequired: false,
        body: new EmptySchema(),
        mediaType: '',
        extensions: {
          openapiV3: {
            operationId: context.operationId,
          },
        },
        ...parameters,
      },
    ];
  }

  return (
    Object.entries(requestBodyObject.content ?? {})
      // form encoded content as well as multipart types are very complex to handle and will be skipped at first
      .filter(
        ([mediaType]) =>
          !/^multipart\/.*/i.test(mediaType) &&
          mediaType !== 'application/x-www-form-urlencoded' &&
          mediaType !== 'application/xml'
      )
      .map(([mediaType, mediaTypeObject]) => {
        const isMultipart = /^multipart\/.*/i.test(mediaType);
        const addEncoding =
          mediaType === 'application/x-www-form-urlencoded' || isMultipart;

        const { schema } = processMediaTypeObject(
          mediaTypeObject,
          addEncoding,
          isMultipart
        );

        return {
          type: 'http-request',
          host: context.host,
          port: context.port,
          protocol: context.protocol,
          path: context.path,
          method: context.method,
          description: requestBodyObject.description,
          bodyRequired: requestBodyObject.required ?? false,
          body: schema,
          mediaType,
          extensions: {
            openapiV3: {
              operationId: context.operationId,
            },
          },
          queryParameters: parameters.queryParameters,
          cookies: parameters.cookies,
          pathParameters: parameters.pathParameters,
          headers: {
            ...parameters.headers,
            // ...headers, TODO
          },
        } satisfies ThymianHttpRequest;
      })
  );
}
