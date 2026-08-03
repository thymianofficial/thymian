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
  .explanation(
    "If-Modified-Since only makes sense on GET or HEAD, where the point is to avoid re-sending an unchanged body. When it arrives on any other method, the recipient must pretend the header isn't there and process the request normally. Honoring it elsewhere and returning 304 would be a conformance bug: a 304 on, say, a POST or PUT would mislead the client into thinking its action was skipped as unchanged, breaking the well-defined meaning of conditional retrieval.",
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
