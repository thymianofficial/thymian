import { and, method, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-length-for-2xx-connect-response',
)
  .severity('error')
  // Implementable now (outcome 1): forbidden-header-presence check needing only
  // the Content-Length header NAME, the request method, and the status code, so
  // the common projection serves static/test/analyze via one shared `.rule()`.
  // `appliesTo('origin server')` matches the default HAR response role.
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
