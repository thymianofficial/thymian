import { and, getHeader, method, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-should-not-send-content-length-without-content',
)
  .severity('warn')
  .type('analytics', 'test')
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
      ),
      (request, response) => {
        const contentLength = getHeader(request.headers, 'content-length');

        if (!contentLength) {
          return false;
        }

        // Check if Content-Length is non-zero
        const lengthValue = parseInt(String(contentLength), 10);
        if (isNaN(lengthValue) || lengthValue === 0) {
          return false;
        }

        return {
          message: `${request.method.toUpperCase()} request should not send Content-Length with non-zero value (${contentLength}). Methods like GET, HEAD, DELETE typically should not have content.`,
        };
      },
    ),
  )
  .overrideTest((ctx) =>
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
      ),
      (request, response) => {
        const contentLength = getHeader(request.headers, 'content-length');

        if (!contentLength) {
          return false;
        }

        const lengthValue = parseInt(String(contentLength), 10);
        if (isNaN(lengthValue) || lengthValue === 0) {
          return false;
        }

        return {
          message: `${request.method.toUpperCase()} request should not send Content-Length with non-zero value (${contentLength}). Methods like GET, HEAD, DELETE typically should not have content.`,
        };
      },
    ),
  )
  .done();
