import { ThymianFormat, type ThymianHttpResponse } from '@thymian/core';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';

import type {
  HttpTestCase,
  HttpTestTransaction,
  SingleHttpTest,
} from '../http-test/http-test.js';
import type { AssertionFn } from './assertion.js';

const ajv = new Ajv2020();

const validationFns: Record<string, ValidateFunction> = {};

function getOrCompile(res: ThymianHttpResponse, id: string): ValidateFunction {
  if (!(id in validationFns)) {
    validationFns[id] = ajv.compile(res.schema);
  }

  return validationFns[id] as ValidateFunction;
}

export const assertResponseBody: AssertionFn<{
  testCase: HttpTestCase;
  test: SingleHttpTest;
  format: ThymianFormat;
}> = ({ testCase, format }) => {
  const thymianResponse = format.getNode<ThymianHttpResponse>(testCase.resId);

  const validate = getOrCompile(thymianResponse, testCase.resId);

  const valid = validate(testCase.response.body);

  if (valid) {
    return {
      message: 'Valid response body.',
      failed: false,
    };
  } else {
    return {
      message: validate.errors?.map((error) => error.message).join('. ') ?? '',
      failed: false,
    };
  }
};
