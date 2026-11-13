import {
  type HttpRequest,
  type HttpResponse,
  serializeRequest,
  type ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import { exampleRequestTemplate } from '@thymian/core-testing';

import { conformingResponse } from './conforming-response.js';

/**
 * One request and the response it got, as traffic a rule is tested against in
 * `analytics`.
 */
export type RecordedPair = {
  request: HttpRequest;
  response: HttpResponse;
};

/**
 * What a recording differs in from the conforming pair. A field given here
 * replaces the conforming one as a whole: `{ response: { headers: {} } }`
 * records a response without the headers the format declares.
 *
 * The media type the format declares is still named as `content-type`, since
 * the analyzer recognises the transaction in a recording by it among other
 * things. Headers that name a `content-type` themselves record that one.
 */
export type RecordedOverrides = {
  request?: Partial<HttpRequest>;
  response?: Partial<HttpResponse>;
};

/**
 * The conforming recording of a transaction: the request the format describes,
 * with the examples it carries, answered as the format declares it. `overrides`
 * replace fields of the request and of the response.
 *
 * Throws when the format has no transaction with that id, and when the request
 * cannot be built from the format.
 *
 * @example
 * ```typescript
 * await runRule(createdResponsesHaveLocation).analytics(format, {
 *   traffic: [
 *     recorded(format, launchCreated),
 *     recorded(format, launchCreated, { response: { headers: {} } }),
 *   ],
 * });
 * ```
 */
export function recorded(
  format: ThymianFormat,
  transactionId: string,
  overrides: RecordedOverrides = {},
): RecordedPair {
  const transaction = format.getThymianHttpTransactionById(transactionId);

  if (transaction === undefined) {
    throw new Error(
      `Cannot record "${transactionId}": the format has no transaction with that id.`,
    );
  }

  const { thymianReq, thymianRes } = transaction;
  const request = { ...conformingRequest(transaction), ...overrides.request };
  const response = {
    ...conformingResponse(thymianRes),
    ...overrides.response,
  };

  return {
    request: {
      ...request,
      headers: namingMediaType(request.headers, thymianReq.mediaType),
    },
    response: {
      ...response,
      headers: namingMediaType(response.headers, thymianRes.mediaType),
    },
  };
}

/**
 * The request the tester would send for the transaction.
 */
function conformingRequest(transaction: ThymianHttpTransaction): HttpRequest {
  const { thymianReq, thymianRes } = transaction;

  try {
    return serializeRequest({
      requestTemplate: exampleRequestTemplate(transaction),
      source: transaction,
    });
  } catch (error) {
    throw new Error(
      `Cannot record "${thymianHttpTransactionToString(thymianReq, thymianRes)}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * The headers, naming the media type the format declares as `content-type`
 * unless they name one themselves: without it the analyzer does not recognise
 * the transaction in the recording.
 */
function namingMediaType(
  headers: HttpResponse['headers'] = {},
  mediaType: string,
): HttpResponse['headers'] {
  const named = Object.keys(headers).some(
    (name) => name.toLowerCase() === 'content-type',
  );

  return mediaType === '' || named
    ? headers
    : { 'content-type': mediaType, ...headers };
}
