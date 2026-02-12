import { and, getHeader, method, not, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-should-send-content-length-for-request-with-defined-content',
)
  .severity('warn')
  .type('analytics', 'test')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent SHOULD send Content-Length in a request when the method defines a meaning for enclosed content
    and it is not sending Transfer-Encoding.

    This rule validates that POST, PUT, and PATCH requests without Transfer-Encoding header should include
    a Content-Length header.`,
  )
  .summary('User agents SHOULD send Content-Length in requests with content.')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('post'), method('put'), method('patch')),
        not(requestHeader('transfer-encoding')),
        not(requestHeader('content-length')),
      ),
      (request, response) => {
        // Check if the request likely has a body
        const contentType = getHeader(request.headers, 'content-type');

        if (!contentType && !request.body) {
          // No indication of content, might be acceptable
          return false;
        }

        return {
          message: `${request.method.toUpperCase()} request should include Content-Length header when sending content and not using Transfer-Encoding.`,
        };
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('post'), method('put'), method('patch')),
        not(requestHeader('transfer-encoding')),
        not(requestHeader('content-length')),
      ),
      (request, response) => {
        const contentType = getHeader(request.headers, 'content-type');

        if (!contentType && !request.body) {
          return false;
        }

        return {
          message: `${request.method.toUpperCase()} request should include Content-Length header when sending content and not using Transfer-Encoding.`,
        };
      },
    ),
  )
  .done();
