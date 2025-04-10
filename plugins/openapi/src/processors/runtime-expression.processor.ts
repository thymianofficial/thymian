import type { RunExpression } from '../runtime-expression.js';

export function processOpenApiRuntimeExpression(
  expression: RunExpression
): string {
  if (expression === '$url') {
    return '$request/url';
  }

  if (expression === '$method') {
    return '$request/method';
  }

  if (expression === '$statusCode') {
    return '$response/statusCode';
  }

  let ptr = expression.replace(/\./, '/');

  if (/^\$(request|response)\/body#?/.test(ptr)) {
    ptr = ptr.replace(/body#?/, 'body');
  } else {
    ptr = ptr.replace(/\./, '/');
  }

  return ptr;
}

export function isOpenApiRuntimeExpression(
  expression: unknown
): expression is RunExpression {
  return (
    typeof expression === 'string' &&
    /^\$(url|method|statusCode|request|response)/gm.test(expression)
  );
}
