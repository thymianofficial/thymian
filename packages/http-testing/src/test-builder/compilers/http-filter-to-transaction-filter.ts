import {
  type RequestFilterExpression,
  thymianRequestToOrigin,
} from '@thymian/core';
import {
  equalsIgnoreCase,
  type ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import {
  type HttpFilterExpression,
  type ResponseFilterExpression,
} from '@thymian/core';

export type TransactionFilterFn = (
  req: ThymianHttpRequest,
  reqId: string,
  res: ThymianHttpResponse,
  resId: string,
  responses: [string, ThymianHttpResponse][],
) => boolean;

export function httpFilterToTransactionFilter(
  filterExpression: HttpFilterExpression,
  format: ThymianFormat,
): TransactionFilterFn {
  switch (filterExpression.kind) {
    case 'request':
      return requestScopedHttpFilterToTransactionFilter(
        filterExpression,
        format,
      );
    case 'response':
      return responseScopeHttpFilterToTransactionFilter(filterExpression);
    case 'logic': {
      if (filterExpression.type === 'and') {
        return (
          req: ThymianHttpRequest,
          reqId: string,
          res: ThymianHttpResponse,
          resId: string,
          responses: [string, ThymianHttpResponse][],
        ) =>
          filterExpression.filters.every((expr) =>
            httpFilterToTransactionFilter(expr, format)(
              req,
              reqId,
              res,
              resId,
              responses,
            ),
          );
      } else if (filterExpression.type === 'or') {
        return (
          req: ThymianHttpRequest,
          reqId: string,
          res: ThymianHttpResponse,
          resId: string,
          responses: [string, ThymianHttpResponse][],
        ) =>
          filterExpression.filters.some((expr) =>
            httpFilterToTransactionFilter(expr, format)(
              req,
              reqId,
              res,
              resId,
              responses,
            ),
          );
      } else if (filterExpression.type === 'xor') {
        return (
          req: ThymianHttpRequest,
          reqId: string,
          res: ThymianHttpResponse,
          resId: string,
          responses: [string, ThymianHttpResponse][],
        ) =>
          filterExpression.filters
            .map((expr) =>
              httpFilterToTransactionFilter(expr, format)(
                req,
                reqId,
                res,
                resId,
                responses,
              ),
            )
            .reduce((acc, curr) => acc !== curr);
      } else if (filterExpression.type === 'not') {
        return (
          req: ThymianHttpRequest,
          reqId: string,
          res: ThymianHttpResponse,
          resId: string,
          responses: [string, ThymianHttpResponse][],
        ) =>
          !httpFilterToTransactionFilter(filterExpression.filter, format)(
            req,
            reqId,
            res,
            resId,
            responses,
          );
      } else {
        return () => Boolean(filterExpression.value);
      }
    }
  }
}

export function responseScopeHttpFilterToTransactionFilter(
  expression: ResponseFilterExpression,
): TransactionFilterFn {
  switch (expression.type) {
    case 'responseMediaType':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
      ) => res.mediaType === expression.mediaType;
    case 'responseTrailer':
      // TODO
      throw new Error('Currently response trailers are not supported.');
    case 'statusCode':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
      ) => res.statusCode === expression.code;
    case 'hasResponseBody':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
      ) => !!res.schema;
    case 'responseHeader': {
      if (typeof expression.header === 'undefined') {
        return () => false;
      }

      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ) => equalsIgnoreCase(expression.header!, ...Object.keys(res.headers));
    }
    case 'statusCodeRange':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
      ) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expression.start &&
        res.statusCode <= expression.end;
  }
}

export function requestScopedHttpFilterToTransactionFilter(
  filterExpression: RequestFilterExpression,
  format: ThymianFormat,
): TransactionFilterFn {
  switch (filterExpression.type) {
    case 'origin':
      return (req: ThymianHttpRequest) =>
        `${req.protocol}://${req.host}:${req.port}` === filterExpression.origin;
    case 'hasBody':
      return (req: ThymianHttpRequest) => !!req.bodyRequired;
    case 'url':
      return (req: ThymianHttpRequest) =>
        `${req.protocol}://${req.host}:${req.port}${
          req.path.startsWith('/') ? req.path : '/' + req.path
        }` === filterExpression.url;
    case 'port':
      return (req: ThymianHttpRequest) => req.port === filterExpression.port;
    case 'requestMediaType':
      return (req: ThymianHttpRequest) =>
        req.mediaType === filterExpression.mediaType;
    case 'method': {
      if (typeof filterExpression.method === 'undefined') {
        return () => false;
      }

      return (req: ThymianHttpRequest) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        equalsIgnoreCase(req.method, filterExpression.method!);
    }
    case 'requestHeader': {
      if (typeof filterExpression.header === 'undefined') {
        return () => false;
      }

      return (req: ThymianHttpRequest) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        equalsIgnoreCase(filterExpression.header!, ...Object.keys(req.headers));
    }
    case 'queryParam': {
      if (typeof filterExpression.param === 'undefined') {
        return () => false;
      }

      return (req: ThymianHttpRequest) =>
        equalsIgnoreCase(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          filterExpression.param!,
          ...Object.keys(req.queryParameters),
        );
    }
    case 'path':
      return (req: ThymianHttpRequest) => req.path === filterExpression.path;
    case 'hasResponse':
      return (
        req: ThymianHttpRequest,
        reqId: string,
        res: ThymianHttpResponse,
        resId: string,
        responses: [string, ThymianHttpResponse][],
      ) => {
        const fn = httpFilterToTransactionFilter(
          filterExpression.filter,
          format,
        );

        return responses.some(([resId, res]) =>
          fn(req, reqId, res, resId, responses),
        );
      };
    case 'isAuthorized':
      return (_: ThymianHttpRequest, reqId: string) =>
        format.requestIsSecured(reqId) === filterExpression.isAuthorized;
    case 'matches-origin': {
      if (typeof filterExpression.origin === 'undefined') {
        return () => false;
      }

      const regExp = createRegExp(filterExpression.origin);

      return (req) => regExp.test(thymianRequestToOrigin(req));
    }

    default:
      throw new Error(
        `Invalid expression: ${JSON.stringify(filterExpression, null, 2)}.`,
      );
  }
}

export function createRegExp(pattern: string): RegExp {
  const regexString =
    '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '(:\\d{1,5})?$';
  return new RegExp(regexString);
}
