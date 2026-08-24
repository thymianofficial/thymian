import { match } from 'path-to-regexp';

import type { ThymianHttpRequest } from '../../index.js';
import {
  deserializePathParameter,
  malformedStyleMessage,
  unsupportedStyleMessage,
} from '../deserialize-parameter.js';
import type { HttpTestCaseResult } from '../http-test/index.js';
import { ajv } from './ajv.js';
import { describeSchemaError, schemaErrorDetail } from './schema-error.js';

function extractPathParameters(
  actualPath: string,
  templatePath: string,
): Record<string, string> | undefined {
  // Neither the query string nor a `#` fragment is part of the path.
  const pathWithoutQuery =
    actualPath.split('?')[0]?.split('#')[0] ?? actualPath;
  const normalizedTemplate = templatePath.replaceAll(/{([^}]+)}/gi, ':$1');
  // `decode: false` keeps the value percent-encoded, so a delimiter inside an
  // item (`/users/a%2Cb`) survives splitting; each item is decoded afterwards.
  const matchFn = match(normalizedTemplate, { decode: false });
  const result = matchFn(pathWithoutQuery);

  if (!result) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(result.params).map(([key, value]) => [key, String(value)]),
  );
}

function decodePathComponent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
    .flatMap(([name, value]): HttpTestCaseResult[] => {
      const parameter = request.pathParameters[name];

      if (parameter?.schema) {
        // Wire values are strings; `style`/`explode` describe how the
        // described type was serialized into them. Rebuild it before
        // validating, or every non-string parameter fails on type.
        const deserialized = deserializePathParameter(
          name,
          value,
          parameter.schema,
          parameter.style,
          decodePathComponent,
        );

        if (!deserialized.supported) {
          // A style thymian cannot reverse is thymian's limitation (`info`);
          // a value not in its declared style is the request's defect.
          return [
            deserialized.malformed
              ? {
                  type: 'assertion-failure',
                  message: malformedStyleMessage(
                    `Path parameter "${name}"`,
                    deserialized,
                  ),
                  timestamp: Date.now(),
                }
              : {
                  type: 'info',
                  message: unsupportedStyleMessage(
                    `Path parameter "${name}"`,
                    deserialized,
                  ),
                  timestamp: Date.now(),
                },
          ];
        }

        const validate = ajv.compile(parameter.schema);

        validate(deserialized.value);

        if (validate.errors && validate.errors.length > 0) {
          // One assertion-failure per schema error rather than a joined message.
          return validate.errors.map((err) => ({
            type: 'assertion-failure',
            message: describeSchemaError(err, `path parameter "${name}"`),
            ...schemaErrorDetail(err),
            timestamp: Date.now(),
          }));
        }

        return [
          {
            type: 'assertion-success',
            message: `Valid path parameter "${name}".`,
            timestamp: Date.now(),
          },
        ];
      }

      return [
        {
          type: 'info',
          message: `No schema provided for path parameter "${name}".`,
          timestamp: Date.now(),
        },
      ];
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
