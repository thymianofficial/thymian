import { type ThymianHttpResponse } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { processHeadersObject } from './headers-object.processor.js';
import { processMediaTypeObject } from './media-type-object.processor.js';
import type { Parameters } from './utils.js';

export type ResponsesWithLinks = {
  responses: ThymianHttpResponse[];
  links: { name: string; linkObj: OpenApiV31.LinkObject }[];
};

export function processResponseObject(
  responseObject: OpenApiV31.ResponseObject,
  statusCode: number,
  parameters: Parameters
): ResponsesWithLinks {
  const headerParameters = processHeadersObject(
    responseObject.headers as Record<string, OpenApiV31.HeaderObject>
  );

  const links = Object.entries(responseObject.links ?? {}).map(
    ([name, linkObj]) => ({ name, linkObj })
  ) as { name: string; linkObj: OpenApiV31.LinkObject }[];

  const responses = [] as ThymianHttpResponse[];

  if (responseObject.content) {
    responses.push(
      ...Object.entries(responseObject.content)
        .filter(
          ([mediaType]) =>
            !/^multipart\/.*/i.test(mediaType) &&
            mediaType !== 'application/x-www-form-urlencoded' &&
            mediaType !== 'application/xml'
        )
        .map(([mediaType, mediaTypeObject]) => {
          const { schema } = processMediaTypeObject(mediaTypeObject);

          return {
            type: 'http-response',
            description: responseObject.description,
            headers: {
              ...parameters.headers,
              ...headerParameters,
            },
            mediaType,
            statusCode,
            schema,
          } satisfies ThymianHttpResponse;
        })
    );
  } else {
    responses.push({
      type: 'http-response',
      description: responseObject.description,
      headers: {
        ...parameters.headers,
        ...headerParameters,
      },
      mediaType: '',
      statusCode,
    });
  }

  return {
    responses,
    links,
  };
}
