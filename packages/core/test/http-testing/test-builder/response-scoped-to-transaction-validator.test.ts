import { AssertionError } from 'node:assert';

import { describe, expect, it } from 'vitest';

import { responseMediaType, statusCode } from '../../../src/http-filter.js';
import type { HttpTestCaseStepTransaction } from '../../../src/http-testing/http-test/index.js';
import { compileResponseScopedExpressionToTransactionValidationFn } from '../../../src/http-testing/test-builder/compilers/response-scoped-to-transaction-validator.js';

function transactionWithResponse(
  response: Record<string, unknown>,
): HttpTestCaseStepTransaction {
  return { response } as unknown as HttpTestCaseStepTransaction;
}

describe('compileResponseScopedExpressionToTransactionValidationFn', () => {
  it('throws a descriptive AssertionError for a status code mismatch', () => {
    const validate = compileResponseScopedExpressionToTransactionValidationFn(
      statusCode(200),
    );
    const transaction = transactionWithResponse({
      statusCode: 500,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(() => validate(transaction)).toThrow(
      /Response status code should be 200/,
    );

    try {
      validate(transaction);
    } catch (error) {
      expect(error).toBeInstanceOf(AssertionError);
      expect((error as AssertionError).expected).toBe(200);
      expect((error as AssertionError).actual).toBe(500);
    }
  });

  it('describes a content-type mismatch', () => {
    const validate = compileResponseScopedExpressionToTransactionValidationFn(
      responseMediaType('application/json'),
    );
    const transaction = transactionWithResponse({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      trailers: {},
      duration: 0,
    });

    expect(() => validate(transaction)).toThrow(
      /Response Content-Type should be "application\/json"/,
    );
  });

  it('passes when the response matches', () => {
    const validate = compileResponseScopedExpressionToTransactionValidationFn(
      statusCode(200),
    );
    const transaction = transactionWithResponse({
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(() => validate(transaction)).not.toThrow();
  });
});
