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

import { httpFilterExpressionToFilter } from './http-filter-expression-to-filter.js';

type TransactionFilterFn = (
  req: HttpRequest,
  res: HttpResponse,
  source: ThymianHttpTransaction,
) => boolean;

/**
 * Evaluates a filter expression against a live request/response pair, agreeing
 * with the specification-side compiler and the analyzer's SQL: method, header
 * and trailer names compare case-insensitively, and what only the
 * specification knows — `isAuthorized`, `responseWith` and the path template —
 * is answered by the specification through the pair's `source`. Origins and
 * ports carry the default port explicitly, as the specification side does.
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
    visitMethod({ method }) {
      if (typeof method === 'undefined') {
        return () => false;
      }
      return (req: HttpRequest) => equalsIgnoreCase(req.method, method);
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
      // A live request carries the concrete path; the specification side
      // compares the template it was generated from.
      return (_req, _res, source) => source.thymianReq.path === expr.path;
    },
    visitHasResponse(expr) {
      // Whether the operation declares such a response; one live pair cannot
      // answer that for its siblings.
      const declaresResponse = httpFilterExpressionToFilter(expr);
      return (_req, _res, source) => declaresResponse(source, format);
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
      return (req: HttpRequest) => explicitOrigin(req.origin) === expr.origin;
    },
    visitHasBody(expr) {
      return (req: HttpRequest) => {
        const hasBody = req.body !== undefined && req.body !== null;
        return hasBody === (expr.hasBody ?? true);
      };
    },
    visitPort(expr) {
      return (req: HttpRequest) => portOf(new URL(req.origin)) === expr.port;
    },
    visitRequestMediaType(expr) {
      return (req: HttpRequest) => {
        const contentType = getContentType(req.headers);
        return equalsIgnoreCase(contentType, expr.mediaType ?? '');
      };
    },
    visitUrl(expr) {
      return (req: HttpRequest, _res, source) => {
        const { path } = source.thymianReq;
        return (
          `${explicitOrigin(req.origin)}${path.startsWith('/') ? path : '/' + path}` ===
          expr.url
        );
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

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };

function portOf(url: URL): number | undefined {
  return url.port ? Number(url.port) : DEFAULT_PORTS[url.protocol];
}

/** `protocol://host:port`, the way the specification side spells an origin. */
function explicitOrigin(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}:${portOf(url)}`;
}
