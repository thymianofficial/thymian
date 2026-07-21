import { constant, not, requestHeader, statusCode } from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

/**
 * When an If-Range condition is false the recipient must ignore the Range header
 * and return the full representation rather than a 206 Partial Content. We
 * target transactions that already carry a Range header (so range processing is
 * in play), force the If-Range condition to false by setting it to an
 * entity-tag value that cannot match the current representation, and assert the
 * recipient did NOT answer 206. This is a sender-driven probe.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-range-when-if-range-false',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .summary(
    'Recipient MUST ignore Range when If-Range condition is false; SHOULD respond with 200.',
  )
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        // Only transactions that exercise a Range header can demonstrate that
        // the Range was (correctly) ignored.
        .forTransactionsWith(requestHeader('range'))
        // Force the If-Range condition to evaluate to false with an entity-tag
        // value that is extremely unlikely to match the current representation.
        .set(requestHeader('if-range'), constant('"qupaya"'))
        .run()
        // If-Range is false, so the Range MUST be ignored: the response must
        // not be a 206 Partial Content.
        .expectForTransactions(not(statusCode(206)))
        .done(),
    ),
  )
  .done();
