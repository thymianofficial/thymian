import type { ResponseFilterExpression } from '@thymian/core';
import { getHeader, type HttpResponse } from '@thymian/core';

export function extractValueFromResponse(
  response: HttpResponse,
  filter: ResponseFilterExpression,
): unknown {
  switch (filter.type) {
    case 'statusCode':
      return response.statusCode;
    case 'responseHeader':
      return response.headers[filter.header ?? ''];
    case 'responseMediaType':
      return getHeader(response.headers, 'content-type');
    case 'responseTrailer':
      return getHeader(response.trailers, filter.trailer ?? ''); // TODO How should we handle undefined values?
    default:
      throw new Error(`Invalid expression type "${filter.type}".`);
  }
}
