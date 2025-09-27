import {
  and,
  method,
  or,
  responseHeader,
  statusCodeRange,
} from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-not-sent-validator-field-in-response-to-put-request',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    "An origin server MUST NOT send a validator field, such as an ETag or Last-Modified field, in a successful response to PUT unless the request's representation data was saved without any transformation applied to the content (i.e., the resource's new representation data is identical to the content received in the PUT request) and the validator field value reflects the new representation.",
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCodeRange(200, 299), method('PUT')),
      or(responseHeader('etag'), responseHeader('last-modified')),
    ),
  )
  .done();
