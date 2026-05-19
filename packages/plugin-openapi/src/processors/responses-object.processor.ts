import type { PartialBy, ThymianHttpResponse } from '@thymian/core';
import { httpStatusCodeRanges, isHttpStatusCodeRange } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { resolveOpenApiReference } from './openapi-reference-resolver.js';
import {
  processResponseObject,
  type ResponsesWithLinks,
} from './response-object.processor.js';
import type { Parameters } from './utils.js';

export function processResponsesObject(
  responsesObject: OpenApiV31.ResponsesObject | undefined,
  parameters: Parameters,
  document: OpenApiV31.Document,
): ResponsesWithLinks[] {
  const responses: Record<
    string,
    {
      responses: PartialBy<ThymianHttpResponse, 'label' | 'sourceName'>[];
      links: { name: string; linkObj: OpenApiV31.LinkObject }[];
    }
  > = {};

  for (const [statusCode, responseObject] of Object.entries(
    responsesObject ?? {},
  )) {
    const resolvedResponse = resolveOpenApiReference<OpenApiV31.ResponseObject>(
      responseObject,
      document,
      'response',
    );

    if (statusCode === 'default') {
      /* ignored */
    } else if (isHttpStatusCodeRange(statusCode)) {
      httpStatusCodeRanges[statusCode].forEach((code) => {
        const strCode = String(code);

        if (!Object.hasOwn(responses, strCode)) {
          responses[strCode] = processResponseObject(
            resolvedResponse,
            code,
            parameters,
            document,
          );
        }
      });
    } else {
      const statusCodeNumber = +statusCode;

      if (statusCodeNumber < 100 || statusCodeNumber > 599) {
        throw new Error(
          `Invalid status code. Status code must be a valid http status code or status code range (e.g. 2XX), but is ${statusCode}.`,
        );
      }

      responses[statusCode] = processResponseObject(
        resolvedResponse,
        statusCodeNumber,
        parameters,
        document,
      );
    }
  }

  return Object.values(responses).flat();
}
