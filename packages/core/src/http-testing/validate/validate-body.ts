import type { ValidateFunction } from 'ajv';
import { parse } from 'secure-json-parse';
import { is } from 'type-is';

import { type ThymianHttpResponse } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';
import { describeSchemaError, schemaErrorDetail } from './schema-error.js';

export function validateJsonBody(
  body: string,
  response: ThymianHttpResponse,
): HttpTestCaseResult[] {
  let json: unknown;

  try {
    json = parse(body);
  } catch {
    return [
      {
        type: 'assertion-failure',
        message: 'Response body is not valid JSON.',
        timestamp: Date.now(),
      },
    ];
  }

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

  let validate: ValidateFunction;

  try {
    validate = ajv.compile(response.schema);
  } catch (err) {
    // A schema that does not compile is a defect of the API description
    // document, not of the observed response body.
    return [
      {
        type: 'assertion-failure',
        assertion: 'schema-compilation',
        message: `The response schema in the API description document could not be compiled: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      },
    ];
  }

  validate(json);

  if (validate.errors && validate.errors.length > 0) {
    // Emit one assertion-failure per schema error instead of collapsing all of
    // them into a single joined message, so each error is reported on its own.
    return validate.errors.map((err) => ({
      type: 'assertion-failure',
      message: describeSchemaError(err, 'response body'),
      ...schemaErrorDetail(err),
      timestamp: Date.now(),
    }));
  }

  return [
    {
      type: 'assertion-success',
      message: 'Valid response body.',
      timestamp: Date.now(),
    },
  ];
}

export function validateBodyForResponse(
  body: string | undefined,
  response: ThymianHttpResponse,
): HttpTestCaseResult[] {
  if (typeof body === 'undefined') {
    return [];
  }

  if (is(response.mediaType, ['*/vnd+json', '*/json', '+json', 'json'])) {
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
