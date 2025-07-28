import { getHeader, type ThymianHttpResponse } from '@thymian/core';

import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';

export const commonHttpHeaders = [
  'date',
  'content-length',
  'transfer-encoding',
  'content-type',
  'connection',
  'server',
  //'cache-control', TODO: we should discuss about this
  //'etag',
  //'last-modified',
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
  'keep-alive',
] as const;

const commonHeadersSet = new Set<string>(commonHttpHeaders);

// checks if the response is missing required headers
export function checkForMissingHeaders(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return Object.entries(response.headers).reduce((acc, [name, header]) => {
    const value = getHeader(headers, name);

    if (!value && header.required) {
      acc.push({
        type: 'assertion-failure',
        message: `Header "${name}" is required but not included in the response.`,
      });
    }

    return acc;
  }, [] as HttpTestCaseResult[]);
}

// Are there headers included in the response that are not in the description format?
export function checkForAdditionalHeaders(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  const failures = Object.keys(headers)
    .filter(
      (headerName) =>
        !Object.hasOwn(response.headers, headerName) &&
        !commonHeadersSet.has(headerName)
    )
    .map((headerName) => ({
      type: 'assertion-failure',
      message: `Response contains header "${headerName}" that is not included in the description format.`,
    })) as HttpTestCaseResult[];

  return failures.length > 0
    ? failures
    : [
        {
          type: 'assertion-success',
          message: `Response does not contain additional headers that are included in the description format.`,
        },
      ];
}

export function validateExistingHeader(
  headers: Record<string, string | string[] | undefined>,
  response: ThymianHttpResponse
): HttpTestCaseResult[] {
  return Object.entries(headers)
    .filter(([name]) => Object.hasOwn(response.headers, name))
    .map(([name, value]) => {
      if (response.headers[name]?.schema) {
        const validate = ajv.compile(response.headers[name]?.schema);

        validate(value);

        if (validate.errors) {
          return {
            type: 'assertion-failure',
            message: `Invalid value for header ${name}.`,
            timestamp: Date.now(),
          };
        } else {
          return {
            type: 'assertion-success',
            message: `Valid header ${name}.`,
            timestamp: Date.now(),
          };
        }
      }

      return {
        type: 'info',
        message: `No schema provided for header ${name}.`,
        timestamp: Date.now(),
      };
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
