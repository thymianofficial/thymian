import {
  and,
  type CommonHttpRequest,
  not,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-range', 'range')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('if-range'), not(requestHeader('range'))),
      (_req: CommonHttpRequest, _res, location: RuleViolationLocation) => [
        {
          location,
          violation: {
            message:
              'The request carries an If-Range header field but no Range header field. Clients MUST NOT generate If-Range without an accompanying Range header field.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
