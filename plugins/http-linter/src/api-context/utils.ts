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
): FilterFn<
  [CommonHttpRequest, CommonHttpResponse, CommonHttpResponse[], string]
> {
  switch (expression.type) {
    case 'origin':
      return (req) => req.origin === expression.origin;
    case 'hasBody':
      return (req) => req.body;
    case 'port':
      return (req) => +new URL(req.origin).port === expression.port;
    case 'requestMediaType':
      return (req) => req.mediaType === expression.mediaType;
    case 'responseMediaType':
      return (_, res) => res.mediaType === expression.mediaType;
    case 'responseTrailer':
      return (_, res) =>
        equalsIgnoreCase(expression.trailer ?? '', ...res.trailers);
    case 'constant':
      return () => Boolean(expression.value);
    case 'hasResponseBody':
      return (_, res) => res.body;
    case 'statusCodeRange':
      return (_, res) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expression.start &&
        res.statusCode <= expression.end;
    case 'queryParam': {
      if (typeof expression.param === 'undefined') {
        return () => true;
      }
      return (req) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        equalsIgnoreCase(expression.param!, ...req.queryParameters);
    }
    case 'hasResponse':
      return (req, res, responses) => {
        return responses.some((r) => {
          const transactionId = format.graph.findEdge(
            req.id,
            r.id,
            (_, edge) => edge.type === 'http-transaction'
          );

          if (!transactionId) {
            throw new Error('Invalid HTTP transaction ID.');
          }

          return compileExpressionToFilterFn(expression.filter, format)(
            req,
            r,
            [],
            transactionId
          );
        });
      };
    case 'isAuthorized':
      return (req) => format.requestIsSecured(req.id);
    case 'xor':
      return (req, res, responses, id) =>
        expression.filters
          .map((expr) =>
            compileExpressionToFilterFn(expr, format)(req, res, responses, id)
          )
          .reduce((acc, curr) => acc !== curr);
    case 'method':
      return (req) => equalsIgnoreCase(req.method, expression.method ?? '');
    case 'requestHeader':
      return (req) => equalsIgnoreCase(expression.header ?? '', ...req.headers);
    case 'path':
      return (req) => req.path === expression.path;
    case 'statusCode':
      return (_, res) => res.statusCode === expression.code;
    case 'responseHeader':
      return (_, res) =>
        equalsIgnoreCase(expression.header ?? '', ...res.headers);
    case 'and':
      return (req, res, responses, id) =>
        expression.filters.every((e) =>
          compileExpressionToFilterFn(e, format)(req, res, responses, id)
        );
    case 'or':
      return (req, res, responses, id) =>
        expression.filters.some((e) =>
          compileExpressionToFilterFn(e, format)(req, res, responses, id)
        );
    case 'not':
      return (req, res, responses, id) =>
        !compileExpressionToFilterFn(expression.filter, format)(
          req,
          res,
          responses,
          id
        );
  }
}

export function compileExpressionToValidateFn(
  expression: HttpFilterExpression,
  format: ThymianFormat
): FilterFn<[CommonHttpRequest, CommonHttpResponse, string]> {
  switch (expression.type) {
    case 'origin':
      return (req) => req.origin === expression.origin;
    case 'hasBody':
      return (req) => req.body;
    case 'port':
      return (req) => +new URL(req.origin).port === expression.port;
    case 'requestMediaType':
      return (req) => req.mediaType === expression.mediaType;
    case 'responseMediaType':
      return (_, res) => res.mediaType === expression.mediaType;
    case 'responseTrailer':
      return (_, res) =>
        equalsIgnoreCase(expression.trailer ?? '', ...res.trailers);
    case 'constant':
      return () => Boolean(expression.value);
    case 'hasResponseBody':
      return (_, res) => res.body;
    case 'statusCodeRange':
      return (_, res) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expression.start &&
        res.statusCode <= expression.end;
    case 'queryParam': {
      if (typeof expression.param === 'undefined') {
        return () => true;
      }
      return (req) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        equalsIgnoreCase(expression.param!, ...req.queryParameters);
    }
    case 'hasResponse':
      throw new Error('hasResponse is not supported in validate.');
    case 'isAuthorized':
      return (req) => format.requestIsSecured(req.id);
    case 'xor':
      return (req, res, id) =>
        expression.filters
          .map((expr) =>
            compileExpressionToValidateFn(expr, format)(req, res, id)
          )
          .reduce((acc, curr) => acc !== curr);
    case 'method':
      return (req) => equalsIgnoreCase(req.method, expression.method ?? '');
    case 'requestHeader':
      return (req) => equalsIgnoreCase(expression.header ?? '', ...req.headers);
    case 'path':
      return (req) => req.path === expression.path;
    case 'statusCode':
      return (_, res) => res.statusCode === expression.code;
    case 'responseHeader':
      return (_, res) =>
        equalsIgnoreCase(expression.header ?? '', ...res.headers);
    case 'and':
      return (req, res, id) =>
        expression.filters.every((e) =>
          compileExpressionToValidateFn(e, format)(req, res, id)
        );
    case 'or':
      return (req, res, id) =>
        expression.filters.some((e) =>
          compileExpressionToValidateFn(e, format)(req, res, id)
        );
    case 'not':
      return (req, res, id) =>
        !compileExpressionToValidateFn(expression.filter, format)(req, res, id);
  }
}

export function compileExpressionToGroupByFn(
  expression: HttpFilterExpression,
  format: ThymianFormat
): (req: CommonHttpRequest, res: CommonHttpResponse) => string {
  switch (expression.type) {
    case 'origin':
      return (req) => req.origin;
    case 'port':
      return (req) => new URL(req.origin).port;
    case 'requestMediaType':
      return (req) => req.mediaType;
    case 'responseMediaType':
      return (_, res) => res.mediaType;
    case 'constant':
      return () => String(expression.value);
    case 'queryParam':
      return (req) =>
        req.queryParameters.find(
          (p) => p.toLowerCase() === expression.param?.toLowerCase()
        ) ?? '';
    case 'isAuthorized':
      return (req) => String(format.requestIsSecured(req.id));
    case 'method':
      return (req) => req.method.toUpperCase();
    case 'requestHeader':
      return (req) =>
        req.headers.find(
          (p) => p.toLowerCase() === expression.header?.toLowerCase()
        ) ?? '';
    case 'path':
      return (req) => req.path;
    case 'statusCode':
      return (_, res) => res.statusCode.toString();
    case 'responseHeader':
      return (req, res) =>
        res.headers.find(
          (p) => p.toLowerCase() === expression.header?.toLowerCase()
        ) ?? '';
    case 'and':
      return (req, res) =>
        expression.filters
          .map((e) => compileExpressionToGroupByFn(e, format)(req, res))
          .filter(Boolean)
          .join(' ');
    default:
      throw new Error(`Unsupported group by expression: ${expression.type}`);
  }
}
