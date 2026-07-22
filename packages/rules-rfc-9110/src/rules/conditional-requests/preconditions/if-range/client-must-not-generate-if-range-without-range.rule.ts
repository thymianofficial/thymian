import {
  and,
  type CommonHttpRequest,
  not,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * The constraint is decidable from header NAMES alone — an If-Range present
 * without a Range — so the common projection is sufficient in both contexts and
 * the check is identical. `lint` validates the described request shape (an
 * OpenAPI operation may declare an If-Range parameter with no Range);
 * `analytics` checks real recorded requests, hence `appliesTo` is scoped to the
 * client roles so it fires on HAR requests. It is intentionally NOT in `test`
 * (Thymian generates the request, so the client's header choices are not under
 * user control).
 */
export default httpRule(
  'rfc9110/client-must-not-generate-if-range-without-range',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field in a request that does not contain a Range header field.',
  )
  .summary('Client MUST NOT generate If-Range without Range header field.')
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('if-range'), not(requestHeader('range'))),
      (_req: CommonHttpRequest, _res, location: RuleViolationLocation) => [
        {
          location,
          violation: {
            message:
              'The request carries an If-Range header field but no Range header field.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
