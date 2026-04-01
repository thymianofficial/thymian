import { match } from 'path-to-regexp';

import type { ThymianHttpRequest } from '../../index.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';

function extractPathParameters(
  actualPath: string,
  templatePath: string,
): Record<string, string> | undefined {
  const pathWithoutQuery = actualPath.split('?')[0] ?? actualPath;
  const normalizedTemplate = templatePath.replaceAll(/{([^}]+)}/gi, ':$1');
  const matchFn = match(normalizedTemplate);
  const result = matchFn(pathWithoutQuery);

  if (!result) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(result.params).map(([key, value]) => [key, String(value)]),
  );
}

export function checkForMissingPathParameters(
  pathParams: Record<string, string>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(request.pathParameters).reduce((acc, [name, param]) => {
    if (!(name in pathParams) && param.required) {
      acc.push({
        type: 'assertion-failure',
        message: `Path parameter "${name}" is required but not included in the request path.`,
      });
    }

    return acc;
  }, [] as HttpTestCaseResult[]);
}

export function validateExistingPathParameter(
  pathParams: Record<string, string>,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  return Object.entries(pathParams)
    .filter(([name]) => Object.hasOwn(request.pathParameters, name))
    .map(([name, value]) => {
      if (request.pathParameters[name]?.schema) {
        const validate = ajv.compile(request.pathParameters[name]?.schema);

        validate(value);

        if (validate.errors) {
          return {
            type: 'assertion-failure',
            message: `Invalid value for path parameter "${name}": ${validate.errors.map((err) => err.message).join(', ')}.`,
            timestamp: Date.now(),
          };
        } else {
          return {
            type: 'assertion-success',
            message: `Valid path parameter "${name}".`,
            timestamp: Date.now(),
          };
        }
      }

      return {
        type: 'info',
        message: `No schema provided for path parameter "${name}".`,
        timestamp: Date.now(),
      };
    });
}

export function validateRequestPathParameters(
  actualPath: string,
  request: ThymianHttpRequest,
): HttpTestCaseResult[] {
  const pathParams = extractPathParameters(actualPath, request.path);

  if (!pathParams) {
    return [
      {
        type: 'assertion-failure',
        message: `Request path "${actualPath}" does not match the template path "${request.path}".`,
        timestamp: Date.now(),
      },
    ];
  }

  return [
    ...checkForMissingPathParameters(pathParams, request),
    ...validateExistingPathParameter(pathParams, request),
  ];
}
