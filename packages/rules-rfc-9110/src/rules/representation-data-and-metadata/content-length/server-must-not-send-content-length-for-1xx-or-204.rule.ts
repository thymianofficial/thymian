import {
  and,
  or,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-length-for-1xx-or-204',
)
  .severity('error')
  // Implementable now (outcome 1): a forbidden-header-presence check needing
  // only the Content-Length header NAME and the status code, so the common
  // projection serves static/test/analyze via one shared `.rule()`.
  // `appliesTo('origin server')` matches the default HAR response role so the
  // analyze rule fires on recorded traffic.
  .type('static', 'test', 'analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MUST NOT send a Content-Length header field in any response with a status code of 1xx (Informational) or 204 (No Content).`,
  )
  .summary(
    'Servers MUST NOT send Content-Length header in 1xx or 204 responses.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(statusCodeRange(100, 199), statusCode(204)),
        responseHeader('content-length'),
      ),
      (_req, res, location) => [
        {
          location,
          violation: {
            message: `A ${res.statusCode} response includes a Content-Length header field. A server MUST NOT send Content-Length in any 1xx or 204 response.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
