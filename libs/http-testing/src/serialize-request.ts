import type { HttpRequest } from '@thymian/core';

import type { HttpTestCaseStepTransaction } from './http-test-case.js';
import {
  serializeHeaderParameter,
  serializePathParameter,
  serializeQueryParameter,
} from './serialize-parameter.js';

function serializeBasePath(transaction: HttpTestCaseStepTransaction) {
  return transaction.requestTemplate.path.replace(
    // from https://github.com/scalar/scalar/blob/8165b3b1487ef38a1e97571032b0bd8c32cd9d91/packages/helpers/src/regex/regex-helpers.ts#L8
    /{{\s*([^}\s]+?)\s*}}|{\s*([^}\s]+?)\s*}|:\b[\w.]+\b/g,
    (_, __, parameterName) => {
      if (
        transaction.requestTemplate.pathParameters[parameterName] !== undefined
      ) {
        if (transaction.source?.thymianReq.pathParameters[parameterName]) {
          return serializePathParameter(
            parameterName,
            transaction.requestTemplate.pathParameters[parameterName],
            transaction.source.thymianReq.pathParameters[parameterName].style
          );
        } else {
          const type =
            typeof transaction.requestTemplate.pathParameters[parameterName];

          if (
            type === 'string' ||
            type === 'number' ||
            type === 'boolean' ||
            type === 'bigint' ||
            type === 'symbol'
          ) {
            return String(
              transaction.requestTemplate.pathParameters[parameterName]
            );
          } else {
            throw new Error(
              `Value of path parameter "${parameterName}" must be of type string but got "${type}".`
            );
          }
        }
      } else {
        throw new Error(`Missing value for path parameter "${parameterName}".`);
      }
    }
  );
}

function serializeQuery(transaction: HttpTestCaseStepTransaction) {
  return Object.entries(transaction.requestTemplate.query)
    .map(([name, value]) => {
      if (transaction.source?.thymianReq.queryParameters[name]) {
        return serializeQueryParameter(
          name,
          value,
          transaction.source?.thymianReq.queryParameters[name].style
        );
      } else {
        const type = typeof value;

        if (
          type === 'string' ||
          type === 'number' ||
          type === 'boolean' ||
          type === 'bigint' ||
          type === 'symbol'
        ) {
          return encodeURIComponent(String(value));
        } else {
          throw new Error(
            `Invalid type for query parameter. Got type: ${type}.`
          );
        }
      }
    })
    .join('&');
}

export function serializePath(
  transaction: HttpTestCaseStepTransaction
): string {
  const path = serializeBasePath(transaction);

  const query = serializeQuery(transaction);

  return query ? `${path}?${query}` : path;
}

export function serializeHeaders(
  transaction: HttpTestCaseStepTransaction
): Record<string, string> {
  const headers = transaction.source?.thymianReq.headers ?? {};
  return Object.entries(transaction.requestTemplate.headers).reduce(
    (acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else {
        if (headers[key]) {
          acc[key] = serializeHeaderParameter(key, value, headers[key].style);
        } else {
          throw new Error(
            `Header value must be of type "string" but got "${typeof value}".`
          );
        }
      }

      return acc;
    },
    {} as Record<string, string>
  );
}

export function serializeBody(body: unknown): string | undefined {
  const type = typeof body;

  if (
    type === 'boolean' ||
    type === 'number' ||
    type === 'symbol' ||
    type === 'bigint'
  ) {
    return String(body);
  }

  if (type === 'object') {
    try {
      return JSON.stringify(body);
    } catch (e) {
      throw new Error(`Cannot stringify request body. Error: ${e}`);
    }
  }

  if (type === 'function') {
    throw new Error('Cannot serialize body with type "function".');
  }

  return body as string | undefined;
}

export function serializeRequest(
  transaction: HttpTestCaseStepTransaction
): HttpRequest {
  return {
    body: serializeBody(transaction.requestTemplate.body),
    bodyEncoding: transaction.requestTemplate.bodyEncoding,
    headers: serializeHeaders(transaction),
    method: transaction.requestTemplate.method,
    origin: transaction.requestTemplate.origin,
    path: serializePath(transaction),
  };
}
