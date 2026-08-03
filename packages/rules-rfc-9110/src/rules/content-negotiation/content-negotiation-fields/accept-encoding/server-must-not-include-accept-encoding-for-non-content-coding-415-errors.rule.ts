import {
  and,
  not,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-include-accept-encoding-for-non-content-coding-415-errors',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-encoding')
  .description(
    'In order to avoid confusion with issues related to media types, servers that fail a request with a 415 status for reasons unrelated to content codings MUST NOT include the Accept-Encoding header field.',
  )
  .summary(
    'Servers that fail a request with a 415 status for reasons unrelated to content codings MUST NOT include the Accept-Encoding header field.',
  )
  .explanation(
    "A 415 (Unsupported Media Type) can be raised either because the request's content coding was unacceptable or for unrelated media-type reasons. When the rejection has nothing to do with content codings, the server must not attach an Accept-Encoding header to the response. Including it would falsely signal that the failure was about encodings, misleading the client into retrying with a different content coding when the real problem lies elsewhere.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        statusCode(415),
        not(requestHeader('accept-encoding')),
        responseHeader('accept-encoding'),
      ),
    ),
  )
  .done();
