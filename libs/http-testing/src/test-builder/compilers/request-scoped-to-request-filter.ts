import {
  equalsIgnoreCase,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { and, type HttpFilterExpression } from '@thymian/http-filter';

import type { RequestFilterFn } from '../../operators/index.js';
import { compileResponseScopedExpressionToResponseFilter } from './response-scoped-to-response-filter.js';

export function compileRequestScopedExpressionToRequestFilter(
  expression: HttpFilterExpression,
  format: ThymianFormat
): RequestFilterFn {
  if (expression.kind === 'response') {
    throw new Error(
      'Cannot used an response-based HTTP filter in a request-based context.'
    );
  }

  switch (expression.type) {
    case 'origin':
      return (req: ThymianHttpRequest) =>
        `${req.protocol}://${req.host}:${req.port}` === expression.origin;
    case 'hasBody':
      return (req: ThymianHttpRequest) => !!req.bodyRequired;
    case 'port':
      return (req: ThymianHttpRequest) => req.port === expression.port;
    case 'requestMediaType':
      return (req: ThymianHttpRequest) =>
        req.mediaType === expression.mediaType;
    case 'constant': {
      return () => Boolean(expression.value);
    }
    case 'method':
      return (req: ThymianHttpRequest) =>
        equalsIgnoreCase(req.method, expression.method);
    case 'requestHeader':
      return (req: ThymianHttpRequest) =>
        equalsIgnoreCase(expression.header, ...Object.keys(req.headers));
    case 'queryParam':
      return (req: ThymianHttpRequest) =>
        equalsIgnoreCase(expression.param, ...Object.keys(req.queryParameters));
    case 'path':
      return (req: ThymianHttpRequest) => req.path === expression.path;
    case 'hasResponse':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        responses: [string, ThymianHttpResponse][]
      ) => {
        const fn = compileResponseScopedExpressionToResponseFilter(
          and(...expression.filters),
          format
        );

        return responses.some(([resId, res]) => fn(res, resId, req, reqId));
      };
    case 'isAuthorized':
      return (_: ThymianHttpRequest, reqId: string) =>
        format.requestIsSecured(reqId) === expression.isAuthorized;
    case 'and':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        responses: [string, ThymianHttpResponse][]
      ) =>
        expression.filters.every((expr) =>
          compileRequestScopedExpressionToRequestFilter(expr, format)(
            req,
            reqId,
            responses
          )
        );
    case 'or':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        responses: [string, ThymianHttpResponse][]
      ) =>
        expression.filters.some((expr) =>
          compileRequestScopedExpressionToRequestFilter(expr, format)(
            req,
            reqId,
            responses
          )
        );
    case 'not':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        responses: [string, ThymianHttpResponse][]
      ) =>
        !compileRequestScopedExpressionToRequestFilter(
          expression.filter,
          format
        )(req, reqId, responses);
    case 'xor':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        responses: [string, ThymianHttpResponse][]
      ) => expression.filters.map((expr) =>
        compileRequestScopedExpressionToRequestFilter(expr, format)(
          req,
          reqId,
          responses
        )
      ).reduce((acc, curr) => acc !== curr)
  }
}
