import { equalsIgnoreCase, getHeader, type HttpResponse } from '@thymian/core';
import type { HttpFilterExpression } from '@thymian/http-filter';

export function compileResponseScopedToResponseChecker(
  expression: HttpFilterExpression,
  response: HttpResponse
): boolean {
  if (expression.kind === 'request') {
    throw new Error();
  }

  switch (expression.type) {
    case 'statusCode':
      return expression.code === response.statusCode;
    case 'hasResponseBody':
      return expression.hasBody === !!response.body;
    case 'responseHeader':
      return expression.value
        ? getHeader(response.headers, expression.header) === expression.value
        : equalsIgnoreCase(expression.header, ...Object.keys(response.headers));
    case 'statusCodeRange':
      return (
        response.statusCode <= expression.end &&
        response.statusCode >= expression.start
      );
    case 'and':
      return expression.filters.every((expr) =>
        compileResponseScopedToResponseChecker(expr, response)
      );
    case 'or':
      return expression.filters.some((expr) =>
        compileResponseScopedToResponseChecker(expr, response)
      );
    case 'not':
      return !compileResponseScopedToResponseChecker(
        expression.filter,
        response
      );
    case 'xor':
      return expression.filters
        .map((expr) => compileResponseScopedToResponseChecker(expr, response))
        .reduce((acc, curr) => acc !== curr);
    default:
      throw new Error();
  }
}
