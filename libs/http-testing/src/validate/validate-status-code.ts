import type { HttpTestCaseResult } from '../http-test/index.js';

export function validateStatusCode(
  statusCode: number,
  actualStatusCode: number,
): HttpTestCaseResult {
  if (statusCode !== actualStatusCode) {
    return {
      type: 'assertion-failure',
      message: `Expected status code ${statusCode}, but received ${actualStatusCode}.`,
    };
  } else {
    return {
      type: 'assertion-success',
      message: `Expected and received status code ${statusCode}.`,
    };
  }
}
