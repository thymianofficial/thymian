import type { Parameter } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { processParameterObject } from './parameter-object.processor.js';

export function processHeadersObject(
  headersObject: Record<string, OpenApiV31.HeaderObject> | undefined,
  // https://swagger.io/specification/v3/#response-object
  ignoreContentTypeHeader = true,
): Record<string, Parameter> {
  return Object.entries(headersObject ?? {}).reduce(
    (acc, [name, headerObject]) => {
      if (ignoreContentTypeHeader && name.toLowerCase() === 'content-type') {
        return acc;
      }

      const [, parameter] = processParameterObject({
        ...headerObject,
        name,
        in: 'header',
      });

      return {
        ...acc,
        [name]: parameter,
      };
    },
    {} as Record<string, Parameter>,
  );
}
