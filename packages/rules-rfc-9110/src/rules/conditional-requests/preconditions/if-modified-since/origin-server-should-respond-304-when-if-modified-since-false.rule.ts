import {
  and,
  httpRule,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  type RuleFnResult,
  singleTestCase,
  statusCode,
} from '@thymian/core';

/**
 * `static` lints the described transaction (an If-Modified-Since request should
 * be able to produce a 304). `test` actively probes real behavior: it replays a
 * fresh GET/HEAD with If-Modified-Since set to the resource's own Last-Modified
 * (so the condition evaluates to false / "not modified") and asserts the server
 * answers 304.
 */
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
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-modified-since'),
        not(responseWith(statusCode(304))),
      ),
    ),
  )
  .overrideTest(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
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
            results.push({
              location: {
                elementType: 'edge',
                elementId: notModifiedTransaction.source.transactionId,
              },
              violation: {
                message: `A GET/HEAD request replayed with If-Modified-Since set to the resource's own Last-Modified value (so the condition is false) received a ${notModifiedTransaction.response.statusCode} response instead of 304 Not Modified. The origin server SHOULD generate a 304 response when the If-Modified-Since condition evaluates to false.`,
              },
              findings: [],
            });
          }
        })
        .done(),
    );
    return results;
  })
  .done();
