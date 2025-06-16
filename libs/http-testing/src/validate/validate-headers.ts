import type { ThymianHttpResponse } from '@thymian/core';

import type { HttpTestCaseResult } from '../http-test-case.js';
import { ajv } from './ajv.js';

export const commonHttpHeaders = [
  'date',
  'content-length',
  'transfer-encoding',
  'content-type',
  'connection',
  'server',
  'cache-control',
  'etag',
  'last-modified',
  'vary',
  'content-encoding',
  'access-control-allow-origin',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
  'access-control-max-age',
  'set-cookie',
  'strict-transport-security',
  'x-powered-by',
] as const;

const commonHeadersSet = new Set<string>(commonHttpHeaders);

// checks if the response is missing required headers
export function checkForMissingHeaders(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return Object.entries(response.headers)
    .filter(
      ([name, header]) => !Object.hasOwn(headers, name) && header.required
    )
    .map(([name]) => ({
      type: 'assertion-failure',
      message: `Header "${name}" is required but not included in the response.`,
    }));
}

// Are there headers included in the response that are not in the description format?
export function checkForAdditionalHeaders(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return Object.keys(headers)
    .filter(
      (headerName) =>
        !Object.hasOwn(response.headers, headerName) &&
        !commonHeadersSet.has(headerName)
    )
    .map((headerName) => ({
      type: 'assertion-failure',
      message: `Response contains header "${headerName}" that is not included in the description format.`,
    }));
}

export function validateExistingHeader(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return Object.entries(headers)
    .filter(([name]) => Object.hasOwn(response.headers, name))
    .flatMap(([name, value]) => {
      const validate = ajv.compile(response.headers[name]!.schema);

      validate(value);

      return (
        validate.errors?.map((err) => ({
          type: 'assertion-failure' as HttpTestCaseResult['type'],
          message: err.message ?? '',
        })) ?? []
      );
    });
}

export function validateHeaders(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return [
    ...checkForMissingHeaders(headers, response),
    ...checkForAdditionalHeaders(headers, response),
    ...validateExistingHeader(headers, response),
  ];
}
