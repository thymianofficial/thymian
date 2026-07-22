import { constant, requestHeader, statusCodeRange } from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

/**
 * When If-Match fails the origin server must not perform the method. Thymian
 * actively forces a failing precondition (an If-Match value that cannot match
 * any current ETag) on a transaction that already exercises If-Match, then
 * asserts the server declined the method with a 4xx (typically 412). This is a
 * sender-driven probe, which only the `test` context can perform.
 */
export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-match-fails',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Match evaluates to false',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(requestHeader('if-match'))
        // we must set any value that would fail the If-Match condition. Let's use "qupaya" for this as it is very unlikely to be an used ETag value
        .set(requestHeader('if-match'), constant('"qupaya"'))
        .run()
        .expectForTransactions(statusCodeRange(400, 499))
        .done(),
    ),
  )
  .done();
