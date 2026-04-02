import { constant, not, requestHeader, statusCode } from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

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
  .appliesTo('server')
  .tags('conditional-requests', 'if-range', 'range', '206')
  .rule((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(requestHeader('if-match'))
        // we must set any value that would fail the If-Match condition. Let's use "qupaya" for this as it is very unlikely to be an used ETag value
        .set(requestHeader('if-range'), constant('"qupaya"'))
        .run()
        .expectForTransactions(not(statusCode(206)))
        .done(),
    ),
  )
  .done();
