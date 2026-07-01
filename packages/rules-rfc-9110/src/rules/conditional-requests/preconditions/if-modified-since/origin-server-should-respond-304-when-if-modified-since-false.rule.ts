import {
  and,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule, requestHeader, type RuleFnResult } from '@thymian/core';
import { singleTestCase } from '@thymian/core';

/**
 * Implemented as a `test` rule (outcome 1). The previous `static`/`analytics`
 * slot used a filter-only check that flagged every If-Modified-Since request
 * not answered with 304 — but a 200 is the *conformant* response whenever the
 * representation actually changed, so that check produced false positives on
 * normal traffic and could not tell whether the condition was true or false.
 * Deciding the condition requires controlling the request's If-Modified-Since
 * value relative to the resource's Last-Modified, which only the sender-driven
 * `test` context can do. We replay a fresh GET/HEAD with If-Modified-Since set
 * to the resource's own Last-Modified (so the condition evaluates to false /
 * "not modified") and assert the server answers 304. Reclassified to test-only.
 */
export default httpRule(
  'rfc9110/origin-server-should-respond-304-when-if-modified-since-false',
)
  .severity('warn')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'An origin server that evaluates an If-Modified-Since condition SHOULD NOT perform the requested method if the condition evaluates to false; instead, the origin server SHOULD generate a 304 (Not Modified) response, including only those metadata that are useful for identifying or updating a previously cached response.',
  )
  .summary(
    'Origin server SHOULD respond with 304 when If-Modified-Since condition is false.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-modified-since', '304')
  .rule(async (ctx) => {
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
