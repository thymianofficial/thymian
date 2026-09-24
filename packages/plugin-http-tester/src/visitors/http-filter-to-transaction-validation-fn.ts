import {
  createFilterVisitor,
  createRegExpFromOriginWildcard,
  equalsIgnoreCase,
  getContentType,
  getHeader,
  type HttpFilterExpression,
  type HttpFilterVisitor,
  type HttpRequest,
  type HttpResponse,
  queryParamsFromRequest,
  type ThymianFormat,
  type ThymianHttpTransaction,
  visitHttpFilter,
} from '@thymian/core';

type TransactionFilterFn = (
  req: HttpRequest,
  res: HttpResponse,
  source: ThymianHttpTransaction,
) => boolean;

/**
 * Evaluates a filter expression against a live request/response pair, agreeing
 * with the specification-side compiler and the analyzer's SQL: method, header
 * and trailer names compare case-insensitively, and `isAuthorized` is answered
 * by the specification through the pair's `source`.
 */
export function httpFilterToTransactionValidationFn(
  filterExpression: HttpFilterExpression,
  format: ThymianFormat,
): TransactionFilterFn {
  return visitHttpFilter(
    filterExpression,
    createTransactionValidationVisitor(format),
  ) as TransactionFilterFn;
}

function createTransactionValidationVisitor(
  format: ThymianFormat,
): HttpFilterVisitor<TransactionFilterFn> {
  return createFilterVisitor({
    visitMethod(expr) {
      if (typeof expr.method === 'undefined') {
        return () => false;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (req: HttpRequest) => equalsIgnoreCase(req.method, expr.method!);
    },
    visitRequestHeader(expr) {
      return (req: HttpRequest) => {
        if (!req.headers || !expr.header) {
          return false;
        }

        const headerValue = getHeader(req.headers, expr.header);
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
      return (req, res, source) => {
        const fn = httpFilterToTransactionValidationFn(expr.filter, format);
        return !!fn(req, res, source);
      };
    },
    visitIsAuthorized({ isAuthorized }) {
      return (_req, _res, source) =>
        format.requestIsSecured(source.thymianReqId) === isAuthorized;
    },
    visitProtocol({ protocol }) {
      if (typeof protocol === 'undefined') {
        return () => false;
      }
      return (req: HttpRequest) =>
        req.origin.toLowerCase().startsWith(`${protocol.toLowerCase()}://`);
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
        const headerValue = getHeader(res.headers, header);
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
        const trailerValue = getHeader(res.trailers, trailer);
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

      return (req: HttpRequest) => regExp.test(req.origin ?? '');
    },
  });
}
