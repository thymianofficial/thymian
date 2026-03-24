import {
  getHeader,
  objHasKeyIgnoreCase,
  type ThymianHttpRequest,
} from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';

export const commonRequestHeaders = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'host',
  'origin',
  'referer',
  'user-agent',
  'te',
  'upgrade',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-request-id',
  'x-correlation-id',
] as const;

const commonRequestHeadersSet = new Set<string>(commonRequestHeaders);

export function checkForMissingRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(request.headers).reduce((acc, [name, header]) => {
    const value = getHeader(headers, name);

    if (!value && header.required) {
      acc.push({
        type: 'assertion-failure',
        message: `Header "${name}" is required but not included in the request.`,
      });
    }

    return acc;
  }, [] as HttpTestCaseResult[]);
}

export function checkForAdditionalRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  const failures = Object.keys(headers)
    .filter(
      (headerName) =>
        !objHasKeyIgnoreCase(request.headers, headerName) &&
        !commonRequestHeadersSet.has(headerName.toLowerCase()),
    )
    .map((headerName) => ({
      type: 'assertion-failure',
      message: `Request contains header "${headerName}" that is not included in the description format.`,
    })) as HttpTestCaseResult[];

  return failures.length > 0
    ? failures
    : [
        {
          type: 'assertion-success',
          message: `Request does not contain additional headers that are not included in the description format.`,
        },
      ];
}

export function validateExistingRequestHeader(
  headers: Record<string, string | string[] | undefined>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(headers)
    .filter(([name]) => Object.hasOwn(request.headers, name))
    .map(([name, value]) => {
      if (request.headers[name]?.schema) {
        const validate = ajv.compile(request.headers[name]?.schema);

        validate(value);

        if (validate.errors) {
          return {
            type: 'assertion-failure',
            message: `Invalid value for request header ${name}: ${validate.errors.map((err) => err.message).join(', ')}.`,
            timestamp: Date.now(),
          };
        } else {
          return {
            type: 'assertion-success',
            message: `Valid request header ${name}.`,
            timestamp: Date.now(),
          };
        }
      }

      return {
        type: 'info',
        message: `No schema provided for request header ${name}.`,
        timestamp: Date.now(),
      };
    });
}

export function validateRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return [
    ...checkForMissingRequestHeaders(headers, request),
    ...checkForAdditionalRequestHeaders(headers, request),
    ...validateExistingRequestHeader(headers, request),
  ];
}
