import {
  equalsIgnoreCase,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import type { HttpFilterExpression } from '@thymian/http-filter';

import type { ResponseFilterFn } from '../../operators/index.js';

export function compileResponseScopedExpressionToResponseFilter(
  expression: HttpFilterExpression,
  format: ThymianFormat
): ResponseFilterFn {
  if (expression.kind === 'request') {
    throw new Error(
      'Cannot used an request-based HTTP filter in a response-based context.'
    );
  }

  switch (expression.type) {
    case 'responseMediaType':
      return (res: ThymianHttpResponse) =>
        res.mediaType === expression.mediaType;
    case 'responseTrailer':
      // TODO
      throw new Error('Currently response trailers are not supported.');
    case 'constant':
      return () => Boolean(expression.value);
    case 'statusCode':
      return (res: ThymianHttpResponse) => res.statusCode === expression.code;
    case 'hasResponseBody':
      return (res: ThymianHttpResponse) => !!res.schema;
    case 'responseHeader':
      return (
        res: ThymianHttpResponse,
        resId: string,
        req: ThymianHttpRequest
      ) => equalsIgnoreCase(expression.header, ...Object.keys(req.headers));
    case 'statusCodeRange':
      return (res: ThymianHttpResponse) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expression.start &&
        res.statusCode <= expression.end;
    case 'and':
      return (
        res: ThymianHttpResponse,
        resId: string,
        req: ThymianHttpRequest,
        reqId: string
      ) =>
        expression.filters.every((expr) =>
          compileResponseScopedExpressionToResponseFilter(expr, format)(
            res,
            resId,
            req,
            reqId
          )
        );
    case 'or':
      return (
        res: ThymianHttpResponse,
        resId: string,
        req: ThymianHttpRequest,
        reqId: string
      ) =>
        expression.filters.some((expr) =>
          compileResponseScopedExpressionToResponseFilter(expr, format)(
            res,
            resId,
            req,
            reqId
          )
        );
    case 'xor':
      return (
        res: ThymianHttpResponse,
        resId: string,
        req: ThymianHttpRequest,
        reqId: string
      ) =>
        expression.filters
          .map((expr) =>
            compileResponseScopedExpressionToResponseFilter(expr, format)(
              res,
              resId,
              req,
              reqId
            )
          )
          .reduce((acc, curr) => acc !== curr);
    case 'not':
      return (
        res: ThymianHttpResponse,
        resId: string,
        req: ThymianHttpRequest,
        reqId: string
      ) =>
        !compileResponseScopedExpressionToResponseFilter(
          expression.filter,
          format
        )(res, resId, req, reqId);
  }
}
