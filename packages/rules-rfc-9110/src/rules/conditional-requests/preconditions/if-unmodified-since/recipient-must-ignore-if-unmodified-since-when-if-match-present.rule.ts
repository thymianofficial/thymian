import {
  and,
  constant,
  httpRule,
  method,
  requestHeader,
  type RuleFnResult,
  singleTestCase,
  statusCode,
} from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-when-if-match-present',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore If-Unmodified-Since if the request contains an If-Match header field; the condition in If-Match is considered to be a more accurate replacement for the condition in If-Unmodified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since when If-Match is present.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-unmodified-since', 'if-match')
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(method('GET'), statusCode(200)))
        // If-Match: * evaluates true for any existing representation, so a
        // recipient honoring precedence proceeds (2xx). If-Unmodified-Since with
        // an epoch date would, on its own, fail (412). A recipient that ignores
        // If-Unmodified-Since (as required when If-Match is present) must NOT
        // answer 412.
        .set(requestHeader('if-match'), constant('*'))
        .set(
          requestHeader('if-unmodified-since'),
          constant('Thu, 01 Jan 1970 00:00:00 GMT'),
        )
        .run({ checkStatusCode: false })
        .transactions(([probe]) => {
          if (probe.response.statusCode === 412) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: probe.source.transactionId,
              },
              violation: {
                message:
                  'A request carrying If-Match: * (condition true) together with an If-Unmodified-Since that alone evaluates to failed received 412. When If-Match is present the recipient MUST ignore If-Unmodified-Since; the 412 shows it did not.',
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
