import {
  and,
  getHeader,
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
  .explanation(
    'When a client sends a request that has no body and whose method does not expect one -- such as GET, HEAD, DELETE, CONNECT, OPTIONS, or TRACE -- it should not attach a non-zero Content-Length header. It matters because a Content-Length on a bodyless request signals data that never arrives, which can confuse servers and intermediaries about message framing and, in the worst case, be leveraged for request smuggling.',
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
      (req, _res, location) => {
        const contentLength = getHeader(req.headers, 'content-length');

        if (contentLength === undefined) {
          return [];
        }

        const lines = Array.isArray(contentLength)
          ? contentLength
          : [contentLength];

        const tokens = lines
          .flatMap((line) => line.split(','))
          .map((token) => token.trim());

        // A Content-Length of exactly "0" is consistent with a request that
        // has no content and is not a violation.
        if (tokens.every((token) => token === '0')) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A ${req.method} request carries a Content-Length header field but no content.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
