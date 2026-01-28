import {
  createFilterVisitor,
  equalsIgnoreCase,
  type HttpFilterExpression,
  type ThymianFormat,
  type ThymianHttpTransaction,
  visitHttpFilter,
} from '@thymian/core';

export type StaticFilter = (
  thymianTransaction: ThymianHttpTransaction,
  format: ThymianFormat,
) => boolean;

const visitor = createFilterVisitor<StaticFilter>({
  visitMethod({ method }) {
    if (typeof method === 'undefined') {
      return () => false;
    }
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.method.toLowerCase() === method.toLowerCase();
  },
  visitRequestHeader({ header }) {
    if (typeof header === 'undefined') {
      return () => false;
    }
    return (transaction: ThymianHttpTransaction) => {
      return equalsIgnoreCase(
        header,
        ...Object.keys(transaction.thymianReq.headers),
      );
    };
  },
  visitQueryParam({ param }) {
    if (typeof param === 'undefined') {
      return () => false;
    }
    return (transaction: ThymianHttpTransaction) => {
      return equalsIgnoreCase(
        param,
        ...Object.keys(transaction.thymianReq.queryParameters),
      );
    };
  },
  visitPath({ path }) {
    if (typeof path === 'undefined') {
      return () => false;
    }
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.path === path;
  },
  visitHasResponse({ filter }) {
    const nestedFilter = httpFilterExpressionToFilter(filter);
    return (transaction: ThymianHttpTransaction, format: ThymianFormat) =>
      format
        .getHttpResponsesOf(transaction.thymianReqId)
        .some(([, , transactionId]) => {
          const responseTransaction =
            format.getThymianHttpTransactionById(transactionId);

          if (!responseTransaction) {
            throw new Error('Cannot find transaction.');
          }

          return nestedFilter(responseTransaction, format);
        });
  },
  visitIsAuthorized({ isAuthorized }) {
    return (transaction, format) =>
      format.requestIsSecured(transaction.thymianReqId) === isAuthorized;
  },
  visitOrigin({ origin }) {
    return (transaction: ThymianHttpTransaction) => {
      const req = transaction.thymianReq;
      return `${req.protocol}://${req.host}:${req.port}` === origin;
    };
  },
  visitHasBody({ hasBody }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.bodyRequired === hasBody;
  },
  visitPort({ port }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.port === port;
  },
  visitRequestMediaType({ mediaType }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.mediaType === mediaType;
  },
  visitUrl({ url }) {
    return (transaction: ThymianHttpTransaction) => {
      const req = transaction.thymianReq;
      return (
        `${req.protocol}://${req.host}:${req.port}${
          req.path.startsWith('/') ? req.path : '/' + req.path
        }` === url
      );
    };
  },
  visitProtocol({ protocol }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianReq.protocol === protocol;
  },
  visitStatusCode({ code }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianRes.statusCode === code;
  },
  visitHasResponseBody({ hasBody }) {
    return (transaction: ThymianHttpTransaction) =>
      !!transaction.thymianRes.schema === hasBody;
  },
  visitResponseHeader({ header }) {
    if (typeof header === 'undefined') {
      return () => false;
    }
    return (transaction: ThymianHttpTransaction) =>
      equalsIgnoreCase(header, ...Object.keys(transaction.thymianRes.headers));
  },
  visitStatusCodeRange({ start, end }) {
    return (transaction: ThymianHttpTransaction) => {
      const statusCode = transaction.thymianRes.statusCode;
      return (
        Number.isInteger(statusCode) && statusCode >= start && statusCode <= end
      );
    };
  },
  visitResponseMediaType({ mediaType }) {
    return (transaction: ThymianHttpTransaction) =>
      transaction.thymianRes.mediaType === mediaType;
  },
  visitResponseTrailer() {
    throw new Error('Response trailers are not currently supported.');
  },
});

export function httpFilterExpressionToFilter(
  expression: HttpFilterExpression,
): StaticFilter {
  return visitHttpFilter(expression, visitor);
}
