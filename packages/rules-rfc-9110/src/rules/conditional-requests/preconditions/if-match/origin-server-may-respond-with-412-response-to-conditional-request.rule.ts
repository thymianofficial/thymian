import {
  constant,
  not,
  requestHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-conditional-request',
)
  .severity('hint')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .summary(
    'An origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .explanation(
    'When an origin server evaluates an If-Match condition that turns out false, it must not carry out the requested method, and one permitted way to report this is to return a 412 (Precondition Failed) status. This gives the client a clear, standard signal that the target representation has changed since the entity tag it supplied, so its request was deliberately aborted rather than silently succeeding, which is what prevents accidental overwrites in the lost-update scenario.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('if-match'),
      not(responseWith(statusCode(412))),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(requestHeader('if-match'))
        // we must set any value that would fail the If-Match condition. Let's use "qupaya" for this as it is very unlikely to be an used ETag value
        .set(requestHeader('if-match'), constant('"qupaya"'))
        .run()
        .expectForTransactions(statusCode(412))
        .done(),
    ),
  )
  .done();
