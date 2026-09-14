import {
  getHeader,
  objHasKeyIgnoreCase,
  type ThymianHttpRequest,
} from '../../index.js';
import { deserializeHeaderParameter } from '../deserialize-parameter.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { resultsForDeserialized } from './validate-deserialized.js';

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
    .flatMap(([name, value]): HttpTestCaseResult[] => {
      const parameter = request.headers[name];

      if (parameter?.schema) {
        // Wire values are strings; `style`/`explode` describe how the
        // described type was serialized into them. Rebuild it before
        // validating, or every non-string parameter fails on type.
        const deserialized = deserializeHeaderParameter(
          name,
          value,
          parameter.schema,
          parameter.style,
        );

        return resultsForDeserialized(
          deserialized,
          parameter.schema,
          `Request header "${name}"`,
          `request header "${name}"`,
          `Valid request header ${name}.`,
        );
      }

      return [
        {
          type: 'info',
          message: `No schema provided for request header ${name}.`,
          timestamp: Date.now(),
        },
      ];
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
