import { and, method, not, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-send-content-length-for-request-with-defined-content',
)
  .severity('warn')
  .type('analytics')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent SHOULD send Content-Length in a request when the method defines a meaning for enclosed content and it is not sending Transfer-Encoding.`,
  )
  .summary('User agents SHOULD send Content-Length in requests with content.')
  .explanation(
    'When a client uses a method that carries a body -- like POST, PUT, or PATCH -- and it is not using Transfer-Encoding, it should include a Content-Length header giving the body size (even 0 for an empty body). It matters because the server needs to know how many bytes to read to delimit the request body; without either Content-Length or Transfer-Encoding the server cannot tell where the body ends, which stalls or breaks the request.',
  )
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('post'), method('put'), method('patch')),
        not(requestHeader('transfer-encoding')),
        not(requestHeader('content-length')),
      ),
      (req, _res, location) => [
        {
          location,
          violation: {
            message: `A ${req.method} request sends neither Transfer-Encoding nor Content-Length.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
