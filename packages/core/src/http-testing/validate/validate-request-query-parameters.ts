import type { ThymianHttpRequest } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';

function parseQueryString(
  queryString: string,
): Record<string, string | string[]> {
  const params: Record<string, string[]> = {};

  if (!queryString) {
    return {};
  }

  for (const part of queryString.split('&')) {
    const [key, value] = part.split('=');

    if (!key) {
      continue;
    }

    const decodedKey = decodeURIComponent(key);
    const decodedValue = value ? decodeURIComponent(value) : '';

    if (params[decodedKey]) {
      params[decodedKey].push(decodedValue);
    } else {
      params[decodedKey] = [decodedValue];
    }
  }

  return Object.fromEntries(
    Object.entries(params).map(([key, values]) => [
      key,
      values.length === 1 ? values[0] : values,
    ]),
  ) as Record<string, string | string[]>;
}

export function checkForMissingQueryParameters(
  queryParams: Record<string, string | string[]>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(request.queryParameters).reduce(
    (acc, [name, param]) => {
      if (!(name in queryParams) && param.required) {
        acc.push({
          type: 'assertion-failure',
          message: `Query parameter "${name}" is required but not included in the request.`,
        });
      }

      return acc;
    },
    [] as HttpTestCaseResult[],
  );
}

export function checkForAdditionalQueryParameters(
  queryParams: Record<string, string | string[]>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  const failures = Object.keys(queryParams)
    .filter((name) => !Object.hasOwn(request.queryParameters, name))
    .map((name) => ({
      type: 'assertion-failure',
      message: `Request contains query parameter "${name}" that is not included in the description format.`,
    })) as HttpTestCaseResult[];

  return failures.length > 0
    ? failures
    : [
        {
          type: 'assertion-success',
          message: `Request does not contain additional query parameters that are not included in the description format.`,
        },
      ];
}

export function validateExistingQueryParameter(
  queryParams: Record<string, string | string[]>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(queryParams)
    .filter(([name]) => Object.hasOwn(request.queryParameters, name))
    .map(([name, value]) => {
      if (request.queryParameters[name]?.schema) {
        const validate = ajv.compile(request.queryParameters[name]?.schema);

        validate(value);

        if (validate.errors) {
          return {
            type: 'assertion-failure',
            message: `Invalid value for query parameter "${name}": ${validate.errors.map((err) => err.message).join(', ')}.`,
            timestamp: Date.now(),
          };
        } else {
          return {
            type: 'assertion-success',
            message: `Valid query parameter "${name}".`,
            timestamp: Date.now(),
          };
        }
      }

      return {
        type: 'info',
        message: `No schema provided for query parameter "${name}".`,
        timestamp: Date.now(),
      };
    });
}

export function validateRequestQueryParameters(
  path: string,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  const queryString = path.includes('?') ? (path.split('?')[1] ?? '') : '';
  const queryParams = parseQueryString(queryString);

  return [
    ...checkForMissingQueryParameters(queryParams, request),
    ...checkForAdditionalQueryParameters(queryParams, request),
    ...validateExistingQueryParameter(queryParams, request),
  ];
}
