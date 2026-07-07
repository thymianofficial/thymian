import {
  and,
  constant,
  httpRule,
  method,
  or,
  requestHeader,
  type RuleFnResult,
  singleTestCase,
  statusCode,
} from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-when-if-none-match-present',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore If-Modified-Since if the request contains an If-None-Match header field; the condition in If-None-Match is considered to be a more accurate replacement for the condition in If-Modified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-None-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since when If-None-Match is present.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-modified-since', 'if-none-match')
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
        // If-None-Match with a non-matching validator evaluates true, so a
        // recipient honoring precedence performs the method (2xx). If-Modified-
        // Since with a future date would, on its own, evaluate to "not modified"
        // (304). A recipient that ignores If-Modified-Since (as required when
        // If-None-Match is present) must NOT answer 304.
        .set(requestHeader('if-none-match'), constant('"thymian-no-match"'))
        .set(
          requestHeader('if-modified-since'),
          constant('Sat, 01 Jan 2050 00:00:00 GMT'),
        )
        .run({ checkStatusCode: false })
        .transactions(([probe]) => {
          if (probe.response.statusCode === 304) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: probe.source.transactionId,
              },
              violation: {
                message:
                  'A request carrying a non-matching If-None-Match (condition true) together with an If-Modified-Since that alone evaluates to "not modified" received 304. When If-None-Match is present the recipient MUST ignore If-Modified-Since; the 304 shows it did not.',
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
