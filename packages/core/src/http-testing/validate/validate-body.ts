import { parse } from 'secure-json-parse';

import type { ThymianHttpResponse } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';

export function validateJsonBody(
  body: string,
  response: ThymianHttpResponse,
): HttpTestCaseResult[] {
  try {
    const json = parse(body);

    if (!response.schema) {
      return [
        {
          type: 'info',
          message: 'No response schema is provided.',
          details: '',
          timestamp: Date.now(),
        },
      ];
    }

    const validate = ajv.compile(response.schema);

    validate(json);

    if (validate.errors) {
      return [
        {
          type: 'assertion-failure',
          message: `Invalid response body: ${validate.errors.map((err) => err.instancePath + ' ' + err.message).join(', ')}`,
          timestamp: Date.now(),
        },
      ];
    }

    return [
      {
        type: 'assertion-success',
        message: 'Valid response body.',
        timestamp: Date.now(),
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return [
      {
        type: 'assertion-failure',
        message: 'Response body is not valid JSON.',
        timestamp: Date.now(),
      },
    ];
  }
}

export function validateBodyForResponse(
  body: string | undefined,
  response: ThymianHttpResponse,
): HttpTestCaseResult[] {
  if (typeof body === 'undefined') {
    return [];
  }

  if (/^application\/[^+]*[+]?(json);?.*/.test(response.mediaType)) {
    return validateJsonBody(body, response);
  }

  return [
    {
      type: 'info',
      message: 'Non JSON response body cannot be validated.',
      timestamp: Date.now(),
      details: '',
    },
  ];
}
