import type { Parameter } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { resolveOpenApiReference } from './openapi-reference-resolver.js';
import { processParameterObject } from './parameter-object.processor.js';

export function processHeadersObject(
  headersObject:
    | Record<string, OpenApiV31.HeaderObject | OpenApiV31.ReferenceObject>
    | undefined,
  document: OpenApiV31.Document,
  // https://swagger.io/specification/v3/#response-object
  ignoreContentTypeHeader = true,
): Record<string, Parameter> {
  return Object.entries(headersObject ?? {}).reduce(
    (acc, [name, headerObject]) => {
      if (ignoreContentTypeHeader && name.toLowerCase() === 'content-type') {
        return acc;
      }

      const [, parameter] = processParameterObject(
        {
          ...resolveOpenApiReference<OpenApiV31.HeaderObject>(
            headerObject,
            document,
            'header',
          ),
          name,
          in: 'header',
        },
        document,
      );

      return {
        ...acc,
        [name]: parameter,
      };
    },
    {} as Record<string, Parameter>,
  );
}
