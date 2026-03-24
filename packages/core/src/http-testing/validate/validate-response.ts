import type { HttpResponse, ThymianHttpResponse } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { validateBodyForResponse } from './validate-body.js';
import { validateHeaders } from './validate-headers.js';
import { validateStatusCode } from './validate-status-code.js';

export function validateResponse(
  response: ThymianHttpResponse,
  actualResponse: HttpResponse,
  availableResponses: ThymianHttpResponse[],
): { valid: boolean; results: HttpTestCaseResult[] } {
  const results = [
    validateStatusCode(
      response.statusCode,
      actualResponse.statusCode,
      availableResponses.map(({ statusCode }) => statusCode),
    ),
    ...validateBodyForResponse(actualResponse.body, response),
    ...validateHeaders(actualResponse.headers, response),
  ];

  return {
    results,
    valid: !results.some((r) => r.type === 'assertion-failure'),
  };
}
