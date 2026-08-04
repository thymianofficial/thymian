import type { RequestFilterExpression } from '../../index.js';
import {
  type HttpRequestTemplate,
  isConstant,
  setHeader,
} from '../../index.js';

export function overrideTemplate(
  template: HttpRequestTemplate,
  toRequest: RequestFilterExpression,
  value: unknown,
): HttpRequestTemplate {
  // .set() accepts constant() expressions; unwrap them so the template holds
  // the raw value instead of the expression object.
  const rawValue = isConstant(value) ? value.value : value;

  switch (toRequest.type) {
    case 'method':
      template.method = rawValue as string;
      break;
    case 'requestHeader':
      if (typeof toRequest.header === 'undefined') {
        break;
      }

      setHeader(template.headers, toRequest.header, rawValue);
      break;
    case 'queryParam':
      if (typeof toRequest.param === 'undefined') {
        break;
      }

      setHeader(template.query, toRequest.param, rawValue);
      break;
    case 'path':
      template.path = rawValue as string;
      break;
    case 'origin':
      template.origin = rawValue as string;
      break;
    case 'requestMediaType':
      setHeader(template.headers, 'content-type', toRequest.mediaType);
      break;
    default:
      throw new Error(`Invalid expression type "${toRequest.type}".`);
  }

  return template;
}
