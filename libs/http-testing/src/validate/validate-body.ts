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

    return (
      validate.errors?.map((err) => ({
        type: 'assertion-failure' as HttpTestCaseResult['type'],
        message: err.message ?? '',
      })) ?? []
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return [
      {
        type: 'error',
        message: 'Invalid JSON body.',
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

  return [];
}
