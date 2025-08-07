import { type HttpRequestTemplate, setHeader } from '@thymian/core';
import type { RequestFilterExpression } from '@thymian/http-filter';

export function overrideTemplate(
  template: HttpRequestTemplate,
  toRequest: RequestFilterExpression,
  value: unknown
): HttpRequestTemplate {
  switch (toRequest.type) {
    case 'method':
      template.method = value as string;
      break;
    case 'requestHeader':
      setHeader(template.headers, toRequest.header, value);
      break;
    case 'queryParam':
      setHeader(template.query, toRequest.param, value);
      break;
    case 'path':
      template.path = value as string;
      break;
    case 'origin':
      template.origin = value as string;
      break;
    case 'requestMediaType':
      setHeader(template.headers, 'content-type', toRequest.mediaType);
      break;
    default:
      throw new Error(`Invalid expression type "${toRequest.type}".`);
  }

  return template;
}
