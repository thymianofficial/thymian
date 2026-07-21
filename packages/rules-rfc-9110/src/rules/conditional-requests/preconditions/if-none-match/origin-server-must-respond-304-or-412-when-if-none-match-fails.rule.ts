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
 * `static` lints the described transaction (an If-None-Match request should
 * produce 304 for GET/HEAD or 412 for other methods when the condition fails).
 * `test` actively probes real behavior: it replays a fresh GET/HEAD with
 * If-None-Match set to the resource's own ETag (so the condition is false / the
 * tag matches) and asserts the origin server answers 304.
 */
export default httpRule(
  'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
)
  .severity('error')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An origin server that evaluates an If-None-Match condition MUST NOT perform the requested method if the condition evaluates to false; instead, the origin server MUST respond with either a) the 304 (Not Modified) status code if the request method is GET or HEAD or b) the 412 (Precondition Failed) status code for all other request methods.',
  )
  .summary(
    'Origin server MUST respond with 304 for GET/HEAD or 412 for other methods when If-None-Match fails.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-none-match'),
        or(
          and(
            or(method('GET'), method('HEAD')),
            not(responseWith(statusCode(304))),
          ),
          and(
            not(or(method('GET'), method('HEAD'))),
            not(responseWith(statusCode(412))),
          ),
        ),
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
                message: `A GET/HEAD request replayed with If-None-Match set to the resource's own ETag (so the condition evaluates to false / the tag matches) received a ${notModifiedTransaction.response.statusCode} response instead of 304 Not Modified.`,
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
