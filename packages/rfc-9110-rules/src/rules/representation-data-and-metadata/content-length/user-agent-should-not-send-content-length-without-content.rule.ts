import {
  and,
  hasRequestBody,
  method,
  not,
  or,
  requestHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-send-content-length-without-content',
)
  .severity('warn')
  .type('analytics')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent SHOULD NOT send a Content-Length header field when the request message does not contain content
    and the method semantics do not anticipate such data. This prevents confusion and potential security issues
    from unexpected Content-Length headers in requests that should not have message bodies.

    Methods that typically do not have request content: GET, HEAD, DELETE, CONNECT, OPTIONS, TRACE.
    Methods that typically have request content: POST, PUT, PATCH.

    This rule validates that GET, HEAD, DELETE, CONNECT, OPTIONS, and TRACE requests do not send a Content-Length
    header with a non-zero value.`,
  )
  .summary(
    'User agents SHOULD NOT send Content-Length when request has no content.',
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(
          method('get'),
          method('head'),
          method('delete'),
          method('connect'),
          method('options'),
          method('trace'),
        ),
        requestHeader('content-length'),
        not(hasRequestBody()),
      ),
    ),
  )
  .done();
