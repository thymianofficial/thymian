import { and, method, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-length-for-2xx-connect-response',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MUST NOT send a Content-Length header field in any 2xx (Successful) response to a CONNECT request.`,
  )
  .summary(
    'Servers MUST NOT send Content-Length header in 2xx responses to CONNECT requests.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        method('connect'),
        statusCodeRange(200, 299),
        responseHeader('content-length'),
      ),
      (_req, res, location) => [
        {
          location,
          violation: {
            message: `A ${res.statusCode} response to a CONNECT request includes a Content-Length header field. A server MUST NOT send Content-Length in any 2xx response to CONNECT.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
