import type { HttpLink, ThymianHttpRequest } from '@thymian/core';

import type { RunExpression } from '../runtime-expression.js';
import {
  isOpenApiRuntimeExpression,
  processOpenApiRuntimeExpression,
} from './runtime-expression.processor.js';

export function findPartsInRequest(
  req: ThymianHttpRequest,
  name: string
): string[] {
  const parts = [];

  if (name in req.queryParameters) {
    parts.push('query');
  }

  if (name in req.pathParameters) {
    parts.push('path');
  }

  if (name in req.cookies) {
    parts.push('cookie');
  }

  if (name in req.headers) {
    parts.push('header');
  }

  return parts;
}

export function processLinkObjectParameters(
  parameters: Record<string, unknown | RunExpression> | undefined,
  req: ThymianHttpRequest
): Pick<
  HttpLink,
  'pathParameters' | 'queryParameters' | 'headers' | 'cookies'
> {
  const result: Required<
    Pick<HttpLink, 'pathParameters' | 'queryParameters' | 'headers' | 'cookies'>
  > = {
    pathParameters: {},
    queryParameters: {},
    headers: {},
    cookies: {},
  };

  if (!parameters) {
    return result;
  }

  for (const [key, value] of Object.entries(parameters)) {
    const match = /((path|header|cookie|query).)?(.+)/gm.exec(key);

    if (!match) {
      continue;
    }

    const [, , part, name] = match;

    if (!name) {
      continue;
    }

    const finalValue = isOpenApiRuntimeExpression(value)
      ? processOpenApiRuntimeExpression(value)
      : value;

    const parts = part ? [part] : findPartsInRequest(req, name);

    parts.forEach((part) => {
      if (part === 'cookie') {
        result.cookies[name] = finalValue;
      } else if (part === 'path') {
        result.pathParameters[name] = finalValue;
      } else if (part === 'query') {
        result.queryParameters[name] = finalValue;
      } else {
        result.headers[name] = finalValue;
      }
    });
  }

  return result;
}
