import { parse } from 'secure-json-parse';

import type { ThymianHttpRequest } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';
import { describeSchemaError, schemaErrorDetail } from './schema-error.js';

export function validateJsonRequestBody(
  body: string,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  try {
    const json = parse(body);

    if (!request.body) {
      return [
        {
          type: 'info',
          message: 'No request body schema is provided.',
          details: '',
          timestamp: Date.now(),
        },
      ];
    }

    const validate = ajv.compile(request.body);

    validate(json);

    if (validate.errors && validate.errors.length > 0) {
      // Emit one assertion-failure per schema error instead of collapsing all of
      // them into a single joined message, so each error is reported on its own.
      return validate.errors.map((err) => ({
        type: 'assertion-failure',
        message: describeSchemaError(err, 'request body'),
        ...schemaErrorDetail(err),
        timestamp: Date.now(),
      }));
    }

    return [
      {
        type: 'assertion-success',
        message: 'Valid request body.',
        timestamp: Date.now(),
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return [
      {
        type: 'assertion-failure',
        message: 'Request body is not valid JSON.',
        timestamp: Date.now(),
      },
    ];
  }
}

export function validateBodyForRequest(
  body: string | undefined,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  if (typeof body === 'undefined') {
    if (request.bodyRequired) {
      return [
        {
          type: 'assertion-failure',
          message: 'Request body is required but not provided.',
          timestamp: Date.now(),
        },
      ];
    }

    return [];
  }

  if (/^application\/[^+]*[+]?(json);?.*/.test(request.mediaType)) {
    return validateJsonRequestBody(body, request);
  }

  return [
    {
      type: 'info',
      message: 'Non JSON request body cannot be validated.',
      timestamp: Date.now(),
      details: '',
    },
  ];
}
