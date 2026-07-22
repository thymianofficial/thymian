import {
  and,
  type CommonHttpRequest,
  method,
  not,
  or,
  requestHeader,
  type RuleViolationLocation,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * A recipient must ignore If-Modified-Since on a method other than GET or HEAD.
 * A 304 Not Modified answer to such a request reveals that the recipient
 * evaluated (honored) the header instead of ignoring it — a non-conformant
 * outcome detectable from method + header NAME + status, so the common
 * projection suffices and the check is identical for the described transaction
 * and recorded traffic.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-for-non-get-head',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the request method is neither GET nor HEAD.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since for methods other than GET or HEAD.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-modified-since'),
        not(or(method('GET'), method('HEAD'))),
        // A 304 Not Modified shows the recipient honored If-Modified-Since
        // instead of ignoring it for this non-GET/HEAD method.
        statusCode(304),
      ),
      (req: CommonHttpRequest, _res, location: RuleViolationLocation) => [
        {
          location,
          violation: {
            message: `A ${req.method} request carrying If-Modified-Since received a 304 Not Modified response.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
