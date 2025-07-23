import {
  equalsIgnoreCase,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { type HttpFilterExpression } from '@thymian/http-filter';

import type {
  CommonHttpRequest,
  CommonHttpResponse,
  FilterFn,
} from './api-context.js';

export function thymianToCommonHttpRequest(
  id: string,
  node: ThymianHttpRequest
): CommonHttpRequest {
  return {
    id,
    origin: `${node.protocol}://${node.host}:${node.port}`,
    path: node.path,
    method: node.method,
    headers: Object.keys(node.headers),
    queryParameters: Object.keys(node.queryParameters),
    cookies: Object.keys(node.cookies),
    mediaType: node.mediaType,
    body: node.bodyRequired ?? false,
  };
}

export function thymianToCommonHttpResponse(
  id: string,
  node: ThymianHttpResponse
): CommonHttpResponse {
  return {
    id,
    body: !!node.schema,
    headers: Object.keys(node.headers),
    mediaType: node.mediaType,
    statusCode: node.statusCode,
    trailers: [],
  };
}

export function compileExpressionToFilterFn(
  expression: HttpFilterExpression,
  format: ThymianFormat
): FilterFn<[CommonHttpRequest, CommonHttpResponse, string]> {
  switch (expression.type) {
    case 'hasResponseBody':
      return (_, res) => res.body;
    case 'statusCodeRange':
      return (_, res) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expression.start &&
        res.statusCode <= expression.end;
    case 'hasQueryParam':
      return (req) =>
        equalsIgnoreCase(expression.param, ...req.queryParameters);
    case 'hasResponses':
      throw new Error(
        'HTTP filter expression "hasResponse" is not supported in this mode.'
      );
    case 'isAuthorized':
      return (req) => format.requestIsSecured(req.id);
    case 'xor':
      return (req, res, id) =>
        expression.filters
          .map((expr) =>
            compileExpressionToFilterFn(expr, format)(req, res, id)
          )
          .reduce((acc, curr) => acc !== curr);
    case 'method':
      return (req) => equalsIgnoreCase(req.method, expression.method);
    case 'hasRequestHeader':
      return (req) => equalsIgnoreCase(expression.header, ...req.headers);
    case 'path':
      return (req) => req.path === expression.path;
    case 'statusCode':
      return (_, res) => res.statusCode === expression.code;
    case 'responseHeader':
      return (_, res) => equalsIgnoreCase(expression.header, ...res.headers);
    case 'and':
      return (req, res, id) =>
        expression.filters.every((e) =>
          compileExpressionToFilterFn(e, format)(req, res, id)
        );
    case 'or':
      return (req, res, id) =>
        expression.filters.some((e) =>
          compileExpressionToFilterFn(e, format)(req, res, id)
        );
    case 'not':
      return (req, res, id) =>
        !compileExpressionToFilterFn(expression.filter, format)(req, res, id);
    default:
      throw new Error('Unknown filter expression');
  }
}
