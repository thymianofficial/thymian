import {
  and,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule, type RuleFnResult, singleTestCase } from '@thymian/core';

/**
 * The rule only requires 304/412 when the If-None-Match condition is *false*;
 * when the condition is *true* (no stored tag matches the current
 * representation) the conforming answer is a normal 200. Whether the condition
 * is false depends on the request's If-None-Match value relative to the current
 * ETag, which only the sender-driven `test` context can control. We replay a
 * fresh GET/HEAD with If-None-Match set to the resource's own ETag (so the
 * condition is false / "matches") and assert the origin server answers 304.
 */
export default httpRule(
  'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An origin server that evaluates an If-None-Match condition MUST NOT perform the requested method if the condition evaluates to false; instead, the origin server MUST respond with either a) the 304 (Not Modified) status code if the request method is GET or HEAD or b) the 412 (Precondition Failed) status code for all other request methods.',
  )
  .summary(
    'Origin server MUST respond with 304 for GET/HEAD or 412 for other methods when If-None-Match fails.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-none-match', '304', '412')
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
        .run()
        .skipIf(
          not(responseHeader('etag')),
          '200 OK response does not include an ETag header, so an If-None-Match match cannot be triggered.',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
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
                message: `A GET/HEAD request replayed with If-None-Match set to the resource's own ETag (so the condition evaluates to false / the tag matches) received a ${notModifiedTransaction.response.statusCode} response instead of 304 Not Modified. When If-None-Match fails for a GET/HEAD request the origin server MUST respond with 304.`,
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
