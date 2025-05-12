import { ThymianFormat, type ThymianHttpResponse } from '@thymian/core';

import type { HttpTestCase, SingleHttpTest } from '../http-test/http-test.js';
import type { AssertionFn } from './assertion.js';

export const assertStatusCode: AssertionFn<{
  testCase: HttpTestCase;
  test: SingleHttpTest;
  format: ThymianFormat;
}> = ({ testCase, format }) => {
  const thymianResponse = format.getNode<ThymianHttpResponse>(testCase.resId);

  if (thymianResponse.statusCode === testCase.response.statusCode) {
    return {
      message: `Expected status code ${thymianResponse.statusCode} and got status code ${testCase.response.statusCode}.`,
      failed: false,
    };
  } else {
    return {
      message: `Expected status code ${thymianResponse.statusCode} but got status code ${testCase.response.statusCode}.`,
      failed: true,
    };
  }
};
