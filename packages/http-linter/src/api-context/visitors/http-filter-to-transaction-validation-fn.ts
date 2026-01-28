import {
  createFilterVisitor,
  equalsIgnoreCase,
  getContentType,
  type HttpFilterExpression,
  type HttpFilterVisitor,
  type HttpRequest,
  type HttpResponse,
  queryParamsFromRequest,
  visitHttpFilter,
} from '@thymian/core';

import type { ValidationFn } from '../api-context.js';

export function httpFilterToTransactionValidationFn(
  filterExpression: HttpFilterExpression,
): ValidationFn<[HttpRequest, HttpResponse]> {
  return visitHttpFilter(
    filterExpression,
    createTransactionValidationVisitor(),
  );
}

function createTransactionValidationVisitor(): HttpFilterVisitor<
  ValidationFn<[HttpRequest, HttpResponse]>
> {
  return createFilterVisitor({
    visitMethod(expr) {
      if (typeof expr.method === 'undefined') {
        return () => false;
      }
      return (req) => req.method === expr.method;
    },
    visitRequestHeader(expr) {
      return (req) => {
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
      return (req) => {
        const queryParams = queryParamsFromRequest(req);

        const paramValue = queryParams[param];
        if (typeof value === 'undefined') {
          return paramValue !== undefined;
        }
        return paramValue === value;
      };
    },
    visitPath(expr) {
      return (req) => req.path === expr.path;
    },
    visitHasResponse(expr) {
      return (req, res) => {
        const fn = httpFilterToTransactionValidationFn(expr.filter);
        return fn(req, res);
      };
    },
    visitOrigin(expr) {
      return (req) => {
        return req.origin === expr.origin;
      };
    },
    visitHasBody(expr) {
      return (req) => {
        const hasBody = req.body !== undefined && req.body !== null;
        return hasBody === (expr.hasBody ?? true);
      };
    },
    visitPort(expr) {
      return (req) =>
        new URL(req.path, req.origin).port === expr.port?.toString();
    },
    visitRequestMediaType(expr) {
      return (req) => {
        const contentType = getContentType(req.headers);
        return equalsIgnoreCase(contentType, expr.mediaType ?? '');
      };
    },
    visitUrl(expr) {
      return (req) => {
        const url = new URL(req.path, req.origin).toString();
        return url === expr.url;
      };
    },
    visitStatusCode(expr) {
      return (req, res) => res.statusCode === expr.code;
    },
    visitHasResponseBody(expr) {
      return (req, res) => {
        const hasBody = res.body !== undefined && res.body !== null;
        return hasBody === (expr.hasBody ?? true);
      };
    },
    visitResponseHeader({ header, value }) {
      if (typeof header === 'undefined') {
        return () => false;
      }
      return (req, res) => {
        const headerValue = res.headers[header];
        if (typeof value === 'undefined') {
          return headerValue !== undefined;
        }
        return headerValue === value;
      };
    },
    visitStatusCodeRange(expr) {
      return (req, res) =>
        Number.isInteger(res.statusCode) &&
        res.statusCode >= expr.start &&
        res.statusCode <= expr.end;
    },
    visitResponseMediaType({ mediaType }) {
      return (req, res) => {
        const contentType = res.headers['content-type'];
        return contentType?.includes(mediaType) ?? false;
      };
    },
    visitResponseTrailer({ trailer, value }) {
      if (typeof trailer === 'undefined') {
        return () => false;
      }
      return (req, res) => {
        const trailerValue = res.trailers?.[trailer];
        if (typeof value === 'undefined') {
          return trailerValue !== undefined;
        }
        return trailerValue === value;
      };
    },
  });
}
