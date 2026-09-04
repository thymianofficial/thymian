import {
  type HttpRequest,
  isThymianError,
  ThymianBaseError,
} from '../index.js';
import type { HttpTestCaseStepTransaction } from './http-test/http-test-case.js';
import {
  serializeHeaderParameter,
  serializePathParameter,
  serializeQueryParameter,
} from './serialize-parameter.js';

/**
 * The request could not be built from what the description and the hooks
 * supplied — a path parameter with no value, a header that is not a string.
 *
 * One name for every way serialization can fail, because every one of them
 * means the same thing to a caller: this Transaction cannot be executed *as
 * described*. `thymian sampler check` reads that as a skip rather than an
 * error, and the sentence says which value is missing — never which
 * transaction, because every surface that prints one already names it
 * (ADR-0020).
 */
function serializationError(
  message: string,
  suggestions: string[] = [],
): ThymianBaseError {
  return new ThymianBaseError(message, {
    name: 'RequestSerializationError',
    ref: 'https://thymian.dev/references/errors/request-serialization-error/',
    suggestions,
  });
}

/**
 * Whether the request could not be serialized from what the description and the
 * hooks supplied — as opposed to any other way sending can fail.
 *
 * Exported so the one predicate lives beside the one producer: `runRequests`
 * reads it to turn the failure into a skipped case, and `sampler check` reads
 * it to give that Transaction the `skipped` Outcome rather than `errored`.
 */
export function isRequestSerializationError(error: unknown): boolean {
  return isThymianError(error) && error.name === 'RequestSerializationError';
}

const SUPPLY_A_VALUE =
  'Give it a value with an example in the API description, or set it from a hook.';

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
            transaction.source.thymianReq.pathParameters[parameterName].style,
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
              transaction.requestTemplate.pathParameters[parameterName],
            );
          } else {
            throw serializationError(
              `Value of path parameter "${parameterName}" must be a string, but is a ${type}.`,
              [SUPPLY_A_VALUE],
            );
          }
        }
      } else {
        throw serializationError(
          `Missing value for path parameter "${parameterName}".`,
          [SUPPLY_A_VALUE],
        );
      }
    },
  );
}

function serializeQuery(transaction: HttpTestCaseStepTransaction) {
  return Object.entries(transaction.requestTemplate.query)
    .map(([name, value]) => {
      if (transaction.source?.thymianReq.queryParameters[name]) {
        return serializeQueryParameter(
          name,
          value,
          transaction.source?.thymianReq.queryParameters[name].style,
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
          throw serializationError(
            `Value of query parameter "${name}" must be a primitive, but is a ${type}.`,
            [SUPPLY_A_VALUE],
          );
        }
      }
    })
    .join('&');
}

export function serializePath(
  transaction: HttpTestCaseStepTransaction,
): string {
  const path = serializeBasePath(transaction);

  const query = serializeQuery(transaction);

  return query ? `${path}?${query}` : path;
}

export function serializeHeaders(
  transaction: HttpTestCaseStepTransaction,
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
          throw serializationError(
            `Value of header "${key}" must be a string, but is a ${typeof value}.`,
            [SUPPLY_A_VALUE],
          );
        }
      }

      return acc;
    },
    {} as Record<string, string>,
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
      throw serializationError(`Cannot stringify the request body: ${e}`);
    }
  }

  if (type === 'function') {
    throw serializationError(
      'Cannot serialize a request body that is a function.',
    );
  }

  return body as string | undefined;
}

export function serializeRequest(
  transaction: HttpTestCaseStepTransaction,
): HttpRequest {
  if (!transaction.requestTemplate) {
    throw new Error(
      'Missing request template for transaction ' +
        transaction.source?.transactionId,
    );
  }

  return {
    body: serializeBody(transaction.requestTemplate.body),
    bodyEncoding: transaction.requestTemplate.bodyEncoding,
    headers: serializeHeaders(transaction),
    method: transaction.requestTemplate.method,
    origin: transaction.requestTemplate.origin,
    path: serializePath(transaction),
  };
}
