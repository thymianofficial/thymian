import { type RuleViolationLocation, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-retry-after-header-for-503-response',
)
  .severity('hint')
  // Sending Retry-After on a 503 is a conformant MAY, so its absence is not a
  // violation. The check is therefore inverted: it surfaces 503 responses that
  // DO carry a Retry-After header, so users learn the mechanism is in use,
  // rather than flagging the ones that omit it (cf.
  // server-may-send-accept-ranges-none).
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable',
  )
  .description(
    'The server MAY send a Retry-After header field to suggest an appropriate amount of time for the client to wait before retrying the request.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(503),
      (_req, res, location: RuleViolationLocation) =>
        res.headers.some((header) => header.toLowerCase() === 'retry-after')
          ? [
              {
                location,
                findings: [
                  {
                    kind: 'informational',
                    title: 'Server signals retry timing for 503 response',
                    message:
                      'The 503 (Service Unavailable) response carries a Retry-After header field suggesting when the client may retry.',
                  },
                ],
              },
            ]
          : [{ location, findings: [] }],
    ),
  )
  .done();
