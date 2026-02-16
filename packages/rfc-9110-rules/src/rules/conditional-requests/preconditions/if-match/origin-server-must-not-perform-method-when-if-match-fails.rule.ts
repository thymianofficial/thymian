import { constant, requestHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

import { compareETags, parseConditionalETagHeader } from '../../utils.js';

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
  .tags('conditional-requests', 'if-match', '412', 'precondition-failed')
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
