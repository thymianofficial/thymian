import {
  and,
  method,
  not,
  or,
  requestHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-match-fails',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Match evaluates to false; MUST respond with 412 or 2xx.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', '412', 'precondition-failed')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-match'),
        // Looking for responses that are not 412 or 2xx when If-Match should have failed
        // This is a simplified check - full validation would require comparing ETags
        not(or(statusCode(412), statusCodeRange(200, 299))),
      ),
    ),
  )
  .done();
