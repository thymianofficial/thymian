import {
  equalsIgnoreCase,
  type HttpFilterExpression,
  type HttpFilterVisitor,
  type LogicalExpression,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  visitHttpFilter,
} from '@thymian/core';

export type GroupByFn = (
  transaction: ThymianHttpTransaction,
  format: ThymianFormat,
) => string;

const visitor: HttpFilterVisitor<GroupByFn> = {
  visitOrigin() {
    return (transaction) => {
      const req = transaction.thymianReq;
      return `${req.protocol}://${req.host}:${req.port}`;
    };
  },
  visitUrl() {
    return (transaction) => {
      const req = transaction.thymianReq;
      return `${req.protocol}://${req.host}:${req.port}${
        req.path.startsWith('/') ? req.path : '/' + req.path
      }`;
    };
  },
  visitPort() {
    return (transaction) => String(transaction.thymianReq.port);
  },
  visitRequestMediaType() {
    return (transaction) => transaction.thymianReq.mediaType;
  },
  visitResponseMediaType() {
    return (transaction) => transaction.thymianRes.mediaType;
  },
  visitQueryParam({ param }) {
    return (transaction) => {
      if (!param) {
        return '';
      }

      const keys = Object.keys(transaction.thymianReq.queryParameters);
      const found = keys.find((k) => equalsIgnoreCase(k, param));
      return found ? String(transaction.thymianReq.queryParameters[found]) : '';
    };
  },
  visitIsAuthorized() {
    return (transaction, format) =>
      String(format.requestIsSecured(transaction.thymianReqId));
  },
  visitMethod() {
    return (transaction) => transaction.thymianReq.method.toUpperCase();
  },
  visitRequestHeader({ header }) {
    return (transaction) => {
      if (!header) {
        return '';
      }
      const keys = Object.keys(transaction.thymianReq.headers);
      const found = keys.find((k) => equalsIgnoreCase(k, header));
      return found ? String(transaction.thymianReq.headers[found]) : '';
    };
  },
  visitPath() {
    return (transaction) => transaction.thymianReq.path;
  },
  visitStatusCode() {
    return (transaction) => String(transaction.thymianRes.statusCode);
  },
  visitResponseHeader({ header }) {
    return (transaction) => {
      if (!header) {
        return '';
      }
      const keys = Object.keys(transaction.thymianRes.headers);
      const found = keys.find((k) => equalsIgnoreCase(k, header));
      return found ? String(transaction.thymianRes.headers[found]) : '';
    };
  },
  visitHasResponse() {
    throw new ThymianBaseError(
      `Unsupported group by expression "hasResponse" for grouping common HTTP transactions.`,
      {
        name: 'UnsupportedGroupByExpression',
        ref: 'https://thymian.dev/references/errors/unsupported-group-by-expression/',
        suggestions: ['Use another expression type.'],
      },
    );
  },
  visitHasBody() {
    throw new ThymianBaseError(
      `Unsupported group by expression "hasBody" for grouping common HTTP transactions.`,
      {
        name: 'UnsupportedGroupByExpression',
        ref: 'https://thymian.dev/references/errors/unsupported-group-by-expression/',
        suggestions: ['Use another expression type.'],
      },
    );
  },
  visitHasResponseBody() {
    throw new ThymianBaseError(
      `Unsupported group by expression "hasResponseBody" for grouping common HTTP transactions.`,
      {
        name: 'UnsupportedGroupByExpression',
        ref: 'https://thymian.dev/references/errors/unsupported-group-by-expression/',
        suggestions: ['Use another expression type.'],
      },
    );
  },
  visitStatusCodeRange() {
    throw new ThymianBaseError(
      `Unsupported group by expression "statusCodeRange" for grouping common HTTP transactions.`,
      {
        name: 'UnsupportedGroupByExpression',
        ref: 'https://thymian.dev/references/errors/unsupported-group-by-expression/',
        suggestions: ['Use another expression type.'],
      },
    );
  },
  visitProtocol() {
    return (transaction) => transaction.thymianReq.protocol;
  },
  visitResponseTrailer() {
    throw new ThymianBaseError(
      `Unsupported group by expression "responseTrailer" for grouping common HTTP transactions.`,
      {
        name: 'UnsupportedGroupByExpression',
        ref: 'https://thymian.dev/references/errors/unsupported-group-by-expression/',
        suggestions: ['Use another expression type.'],
      },
    );
  },
  visitAnd(expr: Extract<LogicalExpression, { type: 'and' }>): GroupByFn {
    return (transaction, format) =>
      expr.filters
        .map((filter) => httpFilterToGroupByFn(filter)(transaction, format))
        .join(' ');
  },
};

export function httpFilterToGroupByFn(
  expression: HttpFilterExpression,
): GroupByFn {
  return visitHttpFilter(expression, visitor);
}
