import { and, getHeader, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-may-respond-415-for-unacceptable-content-coding',
)
  .severity('hint')
  .type('analytics', 'test')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `An origin server MAY respond with a status code of 415 (Unsupported Media Type) if a representation in
    the request message has a content coding that is not acceptable. This allows servers to reject requests
    with encodings they cannot process.

    This rule validates that when a server responds with 415, there is a Content-Encoding header in the request
    that might have triggered the rejection.`,
  )
  .summary(
    'Origin servers MAY respond with 415 for unacceptable content-coding in requests.',
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(415), requestHeader('content-encoding')),
      (request, response) => {
        const contentEncoding = getHeader(request.headers, 'content-encoding');

        if (!contentEncoding) {
          return false;
        }

        // This is informational - a 415 with Content-Encoding in request suggests
        // the server may be rejecting due to unacceptable encoding
        return {
          message: `Server responded with 415 to request with Content-Encoding: ${contentEncoding}. This may indicate the server does not support this encoding.`,
        };
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(415), requestHeader('content-encoding')),
      (request, response) => {
        const contentEncoding = getHeader(request.headers, 'content-encoding');

        if (!contentEncoding) {
          return false;
        }

        return {
          message: `Server responded with 415 to request with Content-Encoding: ${contentEncoding}. This may indicate the server does not support this encoding.`,
        };
      },
    ),
  )
  .done();
