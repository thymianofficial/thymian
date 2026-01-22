import type { HttpTestCaseResult } from '../http-test/index.js';

export function validateStatusCode(
  statusCode: number,
  actualStatusCode: number,
  availableStatusCodes: number[],
): HttpTestCaseResult {
  if (statusCode !== actualStatusCode) {
    if (!availableStatusCodes.includes(statusCode)) {
      return {
        type: 'assertion-failure',
        message: `Expected status code ${statusCode}, but received ${actualStatusCode}, which is not included in the documented status codes: ${availableStatusCodes.join(', ')}.`,
        expected: statusCode,
        actual: actualStatusCode,
      };
    }

    return {
      type: 'assertion-failure',
      message: `Expected status code ${statusCode}, but received ${actualStatusCode}.`,
      expected: statusCode,
      actual: actualStatusCode,
    };
  } else {
    return {
      type: 'assertion-success',
      message: `Expected and received status code ${statusCode}.`,
    };
  }
}
