import type { ThymianHttpResponse } from '@thymian/core';
import { parse } from 'secure-json-parse';

import type { HttpTestCaseResult } from '../http-test-case.js';
import { ajv } from './ajv.js';

export function validateJsonBody(
  body: string,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  try {
    const json = parse(body);

    const validate = ajv.compile(response.schema);

    validate(json);

    if (validate.errors) {
      return [
        {
          type: 'assertion-failure' as HttpTestCaseResult['type'],
          message: 'Invalid response body.',
        },
      ];
    }

    return [
      {
        type: 'assertion-success',
        message: 'Valid response body.',
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return [
      {
        type: 'assertion-failure',
        message: 'Response body is not valid JSON.',
      },
    ];
  }
}

export function validateBodyForResponse(
  body: string,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  if (/^application\/[^+]*[+]?(json);?.*/.test(response.mediaType)) {
    return validateJsonBody(body, response);
  }

  return [
    {
      type: 'info',
      message: 'Non JSON response body cannot be validated.',
    },
  ];
}
