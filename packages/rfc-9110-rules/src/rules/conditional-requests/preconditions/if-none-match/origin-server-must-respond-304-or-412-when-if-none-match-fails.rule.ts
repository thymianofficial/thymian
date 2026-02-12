import {
  and,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An origin server that evaluates an If-None-Match condition MUST NOT perform the requested method if the condition evaluates to false; instead, the origin server MUST respond with either a) the 304 (Not Modified) status code if the request method is GET or HEAD or b) the 412 (Precondition Failed) status code for all other request methods.',
  )
  .summary(
    'Origin server MUST respond with 304 for GET/HEAD or 412 for other methods when If-None-Match fails.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-none-match', '304', '412')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-none-match'),
        // Check if response is neither 304 nor 412 when If-None-Match should have failed
        not(or(statusCode(304), statusCode(412))),
      ),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
        .run()
        .skipIf(
          not(or(responseHeader('etag'), responseHeader('last-modified'))),
          '200 OK response does not include ETag or Last-Modified header.',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
            .run({ expectStatusCode: 304 })
            .done(),
        )
        .done(),
    ),
  )
  .done();
