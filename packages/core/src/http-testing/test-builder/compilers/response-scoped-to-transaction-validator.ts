import assert from 'node:assert';

import type { HttpFilterExpression } from '../../../index.js';
import { equalsIgnoreCase } from '../../../index.js';
import type { HttpTestCaseTransactionValidationFn } from '../../operators/index.js';

export function compileResponseScopedExpressionToTransactionValidationFn(
  expression: HttpFilterExpression,
): HttpTestCaseTransactionValidationFn {
  if (expression.kind === 'request') {
    throw new Error(
      'Cannot used an request-based HTTP filter in a response-based context.',
    );
  }

  switch (expression.type) {
    case 'responseMediaType':
      return (transaction) =>
        assert.strictEqual(
          transaction.response?.headers['content-type'],
          expression.mediaType,
          `Response Content-Type should be "${expression.mediaType}"`,
        );
    case 'responseTrailer':
      if (typeof expression.trailer === 'undefined') {
        return () => true;
      }

      return (transaction) => {
        if (expression.value) {
          assert.strictEqual(
            transaction.response?.trailers[expression.trailer!],
            expression.value,
            `Response trailer "${expression.trailer}" should be "${expression.value}"`,
          );
        } else {
          assert.ok(
            transaction.response?.trailers[expression.trailer!],
            `Response should include trailer "${expression.trailer}"`,
          );
        }
      };
    case 'constant':
      return () => Boolean(expression.value);
    case 'statusCode':
      return (transaction) =>
        assert.strictEqual(
          transaction.response?.statusCode,
          expression.code,
          `Response status code should be ${expression.code}`,
        );
    case 'hasResponseBody':
      return (transaction) =>
        assert.ok(transaction.response?.body, 'Response should have a body');
    case 'responseHeader': {
      if (typeof expression.header === 'undefined') {
        return () => true;
      }

      return (transaction) =>
        assert.ok(
          equalsIgnoreCase(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expression.header!,
            ...Object.keys(transaction.response?.headers ?? {}),
          ),
          `Response should include header "${expression.header}"`,
        );
    }
    case 'statusCodeRange':
      return (transaction) => {
        const range = `Response status code should be between ${expression.start} and ${expression.end}`;
        assert.ok(transaction.response?.statusCode, range);
        assert.ok(Number.isInteger(transaction.response?.statusCode), range);
        assert.ok(transaction.response.statusCode >= expression.start, range);
        assert.ok(transaction.response.statusCode <= expression.end, range);
      };
    case 'and':
      return (transaction) =>
        expression.filters.every((expr) =>
          compileResponseScopedExpressionToTransactionValidationFn(expr)(
            transaction,
          ),
        );
    case 'or':
      return (transaction) =>
        expression.filters.some((expr) => {
          compileResponseScopedExpressionToTransactionValidationFn(expr)(
            transaction,
          );
        });
    case 'xor':
      return (transaction) =>
        expression.filters.every((expr) =>
          compileResponseScopedExpressionToTransactionValidationFn(expr)(
            transaction,
          ),
        );
    case 'not':
      return (transaction) => {
        try {
          compileResponseScopedExpressionToTransactionValidationFn(
            expression.filter,
          )(transaction);
        } catch {
          return;
        }

        throw new assert.AssertionError({
          message: 'Expression did not fail.',
        });
      };
  }
}
