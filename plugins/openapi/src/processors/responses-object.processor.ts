import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import type { Parameters } from './utils.js';
import {
  processResponseObject,
  type ResponsesWithLinks,
} from './response-object.processor.js';
import type { ThymianHttpResponse } from '@thymian/core';
import {
  httpStatusCodeRanges,
  isHttpStatusCodeRange,
} from '../http-status-code-ranges.js';
import { isValidHttpStatusCode } from '@thymian/http-status-codes';

export function processResponsesObject(
  responsesObject: OpenApiV31.ResponsesObject | undefined,
  parameters: Parameters
): ResponsesWithLinks[] {
  const responses: Record<
    string,
    {
      responses: ThymianHttpResponse[];
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
      if (!isValidHttpStatusCode(statusCode)) {
        throw new Error(
          `Invalid status code. Status code must be a valid http status code or status code range (e.g. 2XX), but is ${statusCode}.`
        );
      }

      responses[statusCode] = processResponseObject(
        responseObject as OpenApiV31.ResponseObject,
        statusCode,
        parameters
      );
    }
  }

  return Object.values(responses).flat();
}
