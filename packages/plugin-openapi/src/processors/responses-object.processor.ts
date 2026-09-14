import type { PartialBy, ThymianHttpResponse } from '@thymian/core';
import { httpStatusCodeRanges, isHttpStatusCodeRange } from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';

import { resolveOpenApiReference } from './openapi-reference-resolver.js';
import {
  processResponseObject,
  type ResponsesWithLinks,
} from './response-object.processor.js';
import type { Parameters } from './utils.js';

/**
 * OpenAPI Specification Extension field names. Extensions are explicitly
 * allowed in the Responses Object and carry metadata, not responses, so they
 * must never be interpreted as status codes.
 *
 * @see https://spec.openapis.org/oas/v3.1.0#specification-extensions
 */
const specificationExtensionPattern = /^x-/;

/**
 * A status code range written in a case other than the uppercase form the
 * OpenAPI Specification requires (e.g. `2xx` instead of `2XX`). Only used to
 * produce a better error message — such keys are rejected, not accepted.
 */
const misCasedStatusCodeRangePattern = /^[1-5]xx$/i;

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
    if (specificationExtensionPattern.test(statusCode)) {
      // Skipped before reference resolution: an extension value is not a
      // Response Object and must not be resolved or coerced as one.
      continue;
    }

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

      if (
        !Number.isInteger(statusCodeNumber) ||
        statusCodeNumber < 100 ||
        statusCodeNumber > 599
      ) {
        throw new Error(
          `Invalid status code. Status code must be a valid http status code or status code range (e.g. 2XX), but is ${statusCode}.${
            misCasedStatusCodeRangePattern.test(statusCode)
              ? ` Status code ranges must be uppercase, use '${statusCode.toUpperCase()}' instead.`
              : ''
          }`,
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
