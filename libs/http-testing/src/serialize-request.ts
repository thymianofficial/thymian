import type { HttpTestCaseTransaction } from './http-test-case.js';
import type { HttpRequest } from './run-requests.js';
import {
  serializeHeaderParameter,
  serializePathParameter,
  serializeQueryParameter,
} from './serialize-parameter.js';

function serializeBasePath(transaction: HttpTestCaseTransaction) {
  return transaction.request.path.replace(
    /{{\s*([^}\s]+?)\s*}}|{\s*([^}\s]+?)\s*}|:\b[\w.]+\b/g,
    (_, __, parameterName) => {
      if (transaction.request.pathParameters[parameterName] !== undefined) {
        if (transaction.source?.thymianReq.pathParameters[parameterName]) {
          return serializePathParameter(
            parameterName,
            transaction.request.pathParameters[parameterName],
            transaction.source.thymianReq.pathParameters[parameterName].style
          );
        } else {
          const type = typeof transaction.request.pathParameters[parameterName];

          if (
            type === 'string' ||
            type === 'number' ||
            type === 'boolean' ||
            type === 'bigint' ||
            type === 'symbol'
          ) {
            return String(transaction.request.pathParameters[parameterName]);
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

function serializeQuery(transaction: HttpTestCaseTransaction) {
  return Object.entries(transaction.request.query)
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

export function serializePath(transaction: HttpTestCaseTransaction): string {
  const path = serializeBasePath(transaction);

  const query = serializeQuery(transaction);

  return `${path}?${query}`;
}

export function serializeHeaders(
  transaction: HttpTestCaseTransaction
): Record<string, string> {
  const headers = transaction.source?.thymianReq.headers ?? {};

  return Object.entries(transaction.request.headers).reduce(
    (acc, [key, value]) => {
      if (headers[key]) {
        acc[key] = serializeHeaderParameter(key, value, headers[key].style);
      } else {
        if (typeof value === 'string') {
          acc[key] = value;
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
  transaction: HttpTestCaseTransaction
): HttpRequest {
  return {
    body: serializeBody(transaction.request.body),
    bodyEncoding: transaction.request.bodyEncoding,
    headers: serializeHeaders(transaction),
    method: transaction.request.method,
    origin: transaction.request.origin,
    path: serializePath(transaction),
  };
}
