import {
  and,
  method,
  or,
  responseHeader,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-not-sent-validator-field-in-response-to-put-request',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    "An origin server MUST NOT send a validator field, such as an ETag or Last-Modified field, in a successful response to PUT unless the request's representation data was saved without any transformation applied to the content (i.e., the resource's new representation data is identical to the content received in the PUT request) and the validator field value reflects the new representation.",
  )
  .explanation(
    "On a successful PUT, your server may only return a validator like ETag or Last-Modified if it stored exactly what the client sent, unchanged, and the validator describes that stored representation. This matters because a client uses the returned validator to conclude the copy it still holds in memory matches the server's, skipping a re-fetch and using it for future conditional requests. If the server transformed the content but returns a validator anyway, the client trusts a stale copy and later conditional requests can silently overwrite or misfire.",
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCodeRange(200, 299), method('PUT')),
      or(responseHeader('etag'), responseHeader('last-modified')),
    ),
  )
  .done();
