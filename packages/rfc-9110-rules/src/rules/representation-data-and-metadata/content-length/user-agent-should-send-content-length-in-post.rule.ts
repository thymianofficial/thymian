import { and, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/user-agent-should-send-content-length-in-post')
  .severity('hint')
  .type('analytics', 'test')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent normally SHOULD send Content-Length in a POST request even when the value is 0 (indicating no content).
    This helps the server understand the request structure and avoid ambiguity about whether content is expected.

    Sending "Content-Length: 0" explicitly signals that the POST request intentionally has no content, which is
    different from omitting the header entirely.

    This rule validates that POST requests without Transfer-Encoding include a Content-Length header.`,
  )
  .summary(
    'User agents SHOULD send Content-Length in POST requests, even when 0.',
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        method('post'),
        not(requestHeader('content-length')),
        not(requestHeader('transfer-encoding')),
      ),
      (request, response) => {
        return {
          message:
            'POST request should include Content-Length header, even when the value is 0.',
        };
      },
    ),
  )
  .overrideTest((ctx) =>
    ctx.validateHttpTransactions(
      and(
        method('post'),
        not(requestHeader('content-length')),
        not(requestHeader('transfer-encoding')),
      ),
      (request, response) => {
        return {
          message:
            'POST request should include Content-Length header, even when the value is 0.',
        };
      },
    ),
  )
  .done();
