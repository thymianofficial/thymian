import type {
  Constant,
  HttpFilterExpression,
  LogicalExpression,
  RequestFilterExpression,
  ResponseFilterExpression,
} from './http-filter.js';

export interface HttpFilterVisitor<TResult> {
  // Request filter visitors
  visitMethod?(
    expr: Extract<RequestFilterExpression, { type: 'method' }>,
  ): TResult;
  visitRequestHeader?(
    expr: Extract<RequestFilterExpression, { type: 'requestHeader' }>,
  ): TResult;
  visitQueryParam?(
    expr: Extract<RequestFilterExpression, { type: 'queryParam' }>,
  ): TResult;
  visitPath?(expr: Extract<RequestFilterExpression, { type: 'path' }>): TResult;
  visitHasResponse?(
    expr: Extract<RequestFilterExpression, { type: 'hasResponse' }>,
  ): TResult;
  visitIsAuthorized?(
    expr: Extract<RequestFilterExpression, { type: 'isAuthorized' }>,
  ): TResult;
  visitOrigin?(
    expr: Extract<RequestFilterExpression, { type: 'origin' }>,
  ): TResult;
  visitHasBody?(
    expr: Extract<RequestFilterExpression, { type: 'hasBody' }>,
  ): TResult;
  visitPort?(expr: Extract<RequestFilterExpression, { type: 'port' }>): TResult;
  visitRequestMediaType?(
    expr: Extract<RequestFilterExpression, { type: 'requestMediaType' }>,
  ): TResult;
  visitUrl?(expr: Extract<RequestFilterExpression, { type: 'url' }>): TResult;
  visitProtocol?(
    expr: Extract<RequestFilterExpression, { type: 'protocol' }>,
  ): TResult;

  // Response filter visitors
  visitStatusCode?(
    expr: Extract<ResponseFilterExpression, { type: 'statusCode' }>,
  ): TResult;
  visitHasResponseBody?(
    expr: Extract<ResponseFilterExpression, { type: 'hasResponseBody' }>,
  ): TResult;
  visitResponseHeader?(
    expr: Extract<ResponseFilterExpression, { type: 'responseHeader' }>,
  ): TResult;
  visitStatusCodeRange?(
    expr: Extract<ResponseFilterExpression, { type: 'statusCodeRange' }>,
  ): TResult;
  visitResponseMediaType?(
    expr: Extract<ResponseFilterExpression, { type: 'responseMediaType' }>,
  ): TResult;
  visitResponseTrailer?(
    expr: Extract<ResponseFilterExpression, { type: 'responseTrailer' }>,
  ): TResult;

  // Logical expression visitors
  visitAnd?(expr: Extract<LogicalExpression, { type: 'and' }>): TResult;
  visitOr?(expr: Extract<LogicalExpression, { type: 'or' }>): TResult;
  visitNot?(expr: Extract<LogicalExpression, { type: 'not' }>): TResult;
  visitXor?(expr: Extract<LogicalExpression, { type: 'xor' }>): TResult;
  visitConstant?(expr: Constant): TResult;
}

export function visitHttpFilter<TResult>(
  expr: HttpFilterExpression,
  visitor: HttpFilterVisitor<TResult>,
): TResult {
  switch (expr.kind) {
    case 'request':
      switch (expr.type) {
        case 'method':
          if (!visitor.visitMethod) {
            throw new Error(
              `Visitor does not implement visitMethod for expression type: ${expr.type}`,
            );
          }
          return visitor.visitMethod(expr);
        case 'requestHeader':
          if (!visitor.visitRequestHeader) {
            throw new Error(
              `Visitor does not implement visitRequestHeader for expression type: ${expr.type}`,
            );
          }
          return visitor.visitRequestHeader(expr);
        case 'queryParam':
          if (!visitor.visitQueryParam) {
            throw new Error(
              `Visitor does not implement visitQueryParam for expression type: ${expr.type}`,
            );
          }
          return visitor.visitQueryParam(expr);
        case 'path':
          if (!visitor.visitPath) {
            throw new Error(
              `Visitor does not implement visitPath for expression type: ${expr.type}`,
            );
          }
          return visitor.visitPath(expr);
        case 'hasResponse':
          if (!visitor.visitHasResponse) {
            throw new Error(
              `Visitor does not implement visitHasResponse for expression type: ${expr.type}`,
            );
          }
          return visitor.visitHasResponse(expr);
        case 'isAuthorized':
          if (!visitor.visitIsAuthorized) {
            throw new Error(
              `Visitor does not implement visitIsAuthorized for expression type: ${expr.type}`,
            );
          }
          return visitor.visitIsAuthorized(expr);
        case 'origin':
          if (!visitor.visitOrigin) {
            throw new Error(
              `Visitor does not implement visitOrigin for expression type: ${expr.type}`,
            );
          }
          return visitor.visitOrigin(expr);
        case 'hasBody':
          if (!visitor.visitHasBody) {
            throw new Error(
              `Visitor does not implement visitHasBody for expression type: ${expr.type}`,
            );
          }
          return visitor.visitHasBody(expr);
        case 'port':
          if (!visitor.visitPort) {
            throw new Error(
              `Visitor does not implement visitPort for expression type: ${expr.type}`,
            );
          }
          return visitor.visitPort(expr);
        case 'requestMediaType':
          if (!visitor.visitRequestMediaType) {
            throw new Error(
              `Visitor does not implement visitRequestMediaType for expression type: ${expr.type}`,
            );
          }
          return visitor.visitRequestMediaType(expr);
        case 'url':
          if (!visitor.visitUrl) {
            throw new Error(
              `Visitor does not implement visitUrl for expression type: ${expr.type}`,
            );
          }
          return visitor.visitUrl(expr);
        case 'protocol':
          if (!visitor.visitProtocol) {
            throw new Error(
              `Visitor does not implement visitProtocol for expression type: ${expr.type}`,
            );
          }
          return visitor.visitProtocol(expr);
        default:
          throw new Error(
            `Unknown request filter type: ${(expr as RequestFilterExpression).type}`,
          );
      }
    case 'response':
      switch (expr.type) {
        case 'statusCode':
          if (!visitor.visitStatusCode) {
            throw new Error(
              `Visitor does not implement visitStatusCode for expression type: ${expr.type}`,
            );
          }
          return visitor.visitStatusCode(expr);
        case 'hasResponseBody':
          if (!visitor.visitHasResponseBody) {
            throw new Error(
              `Visitor does not implement visitHasResponseBody for expression type: ${expr.type}`,
            );
          }
          return visitor.visitHasResponseBody(expr);
        case 'responseHeader':
          if (!visitor.visitResponseHeader) {
            throw new Error(
              `Visitor does not implement visitResponseHeader for expression type: ${expr.type}`,
            );
          }
          return visitor.visitResponseHeader(expr);
        case 'statusCodeRange':
          if (!visitor.visitStatusCodeRange) {
            throw new Error(
              `Visitor does not implement visitStatusCodeRange for expression type: ${expr.type}`,
            );
          }
          return visitor.visitStatusCodeRange(expr);
        case 'responseMediaType':
          if (!visitor.visitResponseMediaType) {
            throw new Error(
              `Visitor does not implement visitResponseMediaType for expression type: ${expr.type}`,
            );
          }
          return visitor.visitResponseMediaType(expr);
        case 'responseTrailer':
          if (!visitor.visitResponseTrailer) {
            throw new Error(
              `Visitor does not implement visitResponseTrailer for expression type: ${expr.type}`,
            );
          }
          return visitor.visitResponseTrailer(expr);
        default:
          throw new Error(
            `Unknown response filter type: ${(expr as ResponseFilterExpression).type}`,
          );
      }
    case 'logic':
      switch (expr.type) {
        case 'and':
          if (!visitor.visitAnd) {
            throw new Error(
              `Visitor does not implement visitAnd for expression type: ${expr.type}`,
            );
          }
          return visitor.visitAnd(expr);
        case 'or':
          if (!visitor.visitOr) {
            throw new Error(
              `Visitor does not implement visitOr for expression type: ${expr.type}`,
            );
          }
          return visitor.visitOr(expr);
        case 'not':
          if (!visitor.visitNot) {
            throw new Error(
              `Visitor does not implement visitNot for expression type: ${expr.type}`,
            );
          }
          return visitor.visitNot(expr);
        case 'xor':
          if (!visitor.visitXor) {
            throw new Error(
              `Visitor does not implement visitXor for expression type: ${expr.type}`,
            );
          }
          return visitor.visitXor(expr);
        case 'constant':
          if (!visitor.visitConstant) {
            throw new Error(
              `Visitor does not implement visitConstant for expression type: ${expr.type}`,
            );
          }
          return visitor.visitConstant(expr);
        default:
          throw new Error(
            `Unknown logical expression type: ${(expr as LogicalExpression).type}`,
          );
      }
    default:
      throw new Error(
        `Unknown expression kind: ${(expr as HttpFilterExpression).kind}`,
      );
  }
}

export function createFilterVisitor<T extends (...args: any[]) => boolean>(
  visitor: HttpFilterVisitor<T>,
): HttpFilterVisitor<T> {
  const extendedVisitor: HttpFilterVisitor<T> = {
    visitAnd(expr) {
      return ((...args: unknown[]) =>
        expr.filters.every((filter) =>
          visitHttpFilter<T>(filter, extendedVisitor)(...args),
        )) as T;
    },
    visitOr(expr) {
      return ((...args: unknown[]) =>
        expr.filters.some((filter) =>
          visitHttpFilter<T>(filter, extendedVisitor)(...args),
        )) as T;
    },
    visitNot(expr) {
      return ((...args: unknown[]) =>
        !visitHttpFilter<T>(expr.filter, extendedVisitor)(...args)) as T;
    },
    visitXor(expr) {
      return ((...args: unknown[]) => {
        const [first, second] = expr.filters;
        const firstResult = visitHttpFilter<T>(first, extendedVisitor)(...args);
        const secondResult = visitHttpFilter<T>(
          second,
          extendedVisitor,
        )(...args);
        return firstResult !== secondResult;
      }) as T;
    },
    visitConstant(expr) {
      return ((...args: unknown[]) => Boolean(expr.value)) as T;
    },
    ...visitor,
  };
  return extendedVisitor;
}
