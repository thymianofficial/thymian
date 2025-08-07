import type { PartialBy, ThymianHttpResponse } from '@thymian/core';
import {
  httpStatusCodeRanges,
  isHttpStatusCodeRange,
} from '@thymian/http-status-codes';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import {
  processResponseObject,
  type ResponsesWithLinks,
} from './response-object.processor.js';
import type { Parameters } from './utils.js';

export function processResponsesObject(
  responsesObject: OpenApiV31.ResponsesObject | undefined,
  parameters: Parameters
): ResponsesWithLinks[] {
  const responses: Record<
    string,
    {
      responses: PartialBy<ThymianHttpResponse, 'label'>[];
      links: { name: string; linkObj: OpenApiV31.LinkObject }[];
    }
  > = {};

  for (const [statusCode, responseObject] of Object.entries(
    responsesObject ?? {}
  )) {
    if (statusCode === 'default') {
      /* ignored */
    } else if (isHttpStatusCodeRange(statusCode)) {
      httpStatusCodeRanges[statusCode].forEach((code) => {
        const strCode = String(code);

        if (!Object.hasOwn(responses, strCode)) {
          responses[strCode] = processResponseObject(
            responseObject as OpenApiV31.ResponseObject,
            code,
            parameters
          );
        }
      });
    } else {
      const statusCodeNumber = +statusCode;

      if (statusCodeNumber < 100 || statusCodeNumber > 599) {
        throw new Error(
          `Invalid status code. Status code must be a valid http status code or status code range (e.g. 2XX), but is ${statusCode}.`
        );
      }

      responses[statusCode] = processResponseObject(
        responseObject as OpenApiV31.ResponseObject,
        statusCodeNumber,
        parameters
      );
    }
  }

  return Object.values(responses).flat();
}
