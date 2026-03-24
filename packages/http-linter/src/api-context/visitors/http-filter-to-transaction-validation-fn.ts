import type { ValidationFn } from '@thymian/core';
import {
  createFilterVisitor,
  equalsIgnoreCase,
  getContentType,
  type HttpFilterExpression,
  type HttpFilterVisitor,
  type HttpRequest,
  type HttpResponse,
  queryParamsFromRequest,
  thymianRequestToOrigin,
  visitHttpFilter,
} from '@thymian/core';

import { createRegExpFromOriginWildcard } from '../../utils.js';

export function httpFilterToTransactionValidationFn(
  filterExpression: HttpFilterExpression,
): ValidationFn<[HttpRequest, HttpResponse]> {
  return visitHttpFilter(
    filterExpression,
    createTransactionValidationVisitor(),
  ) as ValidationFn<[HttpRequest, HttpResponse]>;
}

function createTransactionValidationVisitor(): HttpFilterVisitor<
  ValidationFn<[HttpRequest, HttpResponse]>
> {
  return createFilterVisitor({
    visitMethod(expr) {
      if (typeof expr.method === 'undefined') {
        return () => false;
      }
      return (req: HttpRequest) => req.method === expr.method;
    },
    visitRequestHeader(expr) {
      return (req: HttpRequest) => {
        if (!req.headers || !expr.header) {
          return false;
        }

        const headerValue = req.headers[expr.header];
        if (typeof expr.value === 'undefined') {
          return headerValue !== undefined;
        }
        return headerValue === expr.value;
      };
    },
    visitQueryParam({ param, value }) {
      if (typeof param === 'undefined') {
        return () => false;
      }
      return (req: HttpRequest) => {
        const queryParams = queryParamsFromRequest(req);

        const paramValue = queryParams[param];
        if (typeof value === 'undefined') {
          return paramValue !== undefined;
        }
        return paramValue === value;
      };
    },
    visitPath(expr) {
      return (req: HttpRequest) => req.path === expr.path;
    },
    visitHasResponse(expr) {
      return (req: HttpRequest, res: HttpResponse) => {
        const fn = httpFilterToTransactionValidationFn(expr.filter);
        return !!fn(req, res);
      };
    },
    visitOrigin(expr) {
      return (req: HttpRequest) => {
        return req.origin === expr.origin;
      };
    },
    visitHasBody(expr) {
      return (req: HttpRequest) => {
        const hasBody = req.body !== undefined && req.body !== null;
        return hasBody === (expr.hasBody ?? true);
      };
    },
    visitPort(expr) {
      return (req: HttpRequest) =>
        new URL(req.path, req.origin).port === expr.port?.toString();
    },
    visitRequestMediaType(expr) {
      return (req: HttpRequest) => {
        const contentType = getContentType(req.headers);
        return equalsIgnoreCase(contentType, expr.mediaType ?? '');
      };
    },
    visitUrl(expr) {
      return (req: HttpRequest) => {
        const url = new URL(req.path, req.origin).toString();
        return url === expr.url;
      };
    },
    visitStatusCode(expr) {
      return (_req: HttpRequest, res: HttpResponse) =>
        res.statusCode === expr.code;
    },
    visitHasResponseBody(expr) {
      return (_req: HttpRequest, res: HttpResponse) => {
        const hasBody = res.body !== undefined && res.body !== null;
        return hasBody === (expr.hasBody ?? true);
      };
    },
    visitResponseHeader({ header, value }) {
      if (typeof header === 'undefined') {
        return () => false;
      }
      return (_req: HttpRequest, res: HttpResponse) => {
        const headerValue = res.headers[header];
        if (typeof value === 'undefined') {
          return headerValue !== undefined;
        }
        return headerValue === value;
      };
    },
    visitStatusCodeRange(expr) {
      return (_req: HttpRequest, res: HttpResponse) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expr.start &&
        res.statusCode <= expr.end;
    },
    visitResponseMediaType({ mediaType }) {
      return (_req: HttpRequest, res: HttpResponse) => {
        const contentType = res.headers['content-type'];
        return contentType?.includes(mediaType ?? '') ?? false;
      };
    },
    visitResponseTrailer({ trailer, value }) {
      if (typeof trailer === 'undefined') {
        return () => false;
      }
      return (_req: HttpRequest, res: HttpResponse) => {
        const trailerValue = res.trailers?.[trailer];
        if (typeof value === 'undefined') {
          return trailerValue !== undefined;
        }
        return trailerValue === value;
      };
    },
    visitMatchesOrigin({ origin }) {
      if (typeof origin !== 'string') {
        return () => false;
      }

      const regExp = createRegExpFromOriginWildcard(origin);

      return (transaction) =>
        regExp.test(thymianRequestToOrigin(transaction.thymianReq));
    },
  });
}
