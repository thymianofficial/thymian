import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-respond-304-when-if-modified-since-false',
)
  .severity('warn')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'An origin server that evaluates an If-Modified-Since condition SHOULD NOT perform the requested method if the condition evaluates to false; instead, the origin server SHOULD generate a 304 (Not Modified) response, including only those metadata that are useful for identifying or updating a previously cached response.',
  )
  .summary(
    'Origin server SHOULD respond with 304 when If-Modified-Since condition is false.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-modified-since', '304')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-modified-since'),
        not(responseWith(statusCode(304))),
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
          not(responseHeader('last-modified')),
          'No Last-Modified header to test with',
        )
        .replayStep((step) =>
          step
            .set(
              requestHeader('if-modified-since'),
              responseHeader('last-modified'),
            )
            .run()
            .done(),
        )
        .transactions(([, notModifiedTransaction]) => {
          if (notModifiedTransaction.response.statusCode !== 304) {
            ctx.reportViolation({
              location: {
                elementType: 'edge',
                elementId: notModifiedTransaction.source.transactionId,
              },
            });
          }
        })
        .done(),
    ),
  )
  .done();
