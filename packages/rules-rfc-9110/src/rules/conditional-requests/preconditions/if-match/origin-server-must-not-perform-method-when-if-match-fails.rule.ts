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
  .explanation(
    "When a request carries If-Match, the client is saying 'only do this if the resource still matches the entity tag I have'. If none of the given tags match the resource's current ETag, the server must refuse to carry out the request rather than act on stale assumptions, typically answering 412 Precondition Failed. This is what prevents the 'lost update' problem: two clients editing the same resource in parallel can't unknowingly overwrite each other's changes, because a request built against an out-of-date version is rejected instead of applied.",
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
