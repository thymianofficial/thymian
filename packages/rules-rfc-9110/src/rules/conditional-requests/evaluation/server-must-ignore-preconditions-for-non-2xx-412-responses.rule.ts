import {
  and,
  constant,
  httpRule,
  not,
  requestHeader,
  type RuleFnResult,
  singleTestCase,
  statusCode,
  statusCodeRange,
} from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-preconditions-for-non-2xx-412-responses',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server MUST ignore all received preconditions if its response to the same request without those conditions, prior to processing the request content, would have been a status code other than a 2xx (Successful) or 412 (Precondition Failed). In other words, redirects and failures that can be detected before significant processing occurs take precedence over the evaluation of preconditions.',
  )
  .summary('Server MUST ignore preconditions if response would be non-2xx/412.')
  .appliesTo('origin server')
  .rule(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        // Base transactions whose unconditional response is neither 2xx nor 412:
        // for these the server must ignore preconditions entirely.
        .forTransactionsWith(
          and(
            not(statusCodeRange(200, 299)),
            not(statusCode(412)),
            not(requestHeader('if-match')),
            not(requestHeader('if-none-match')),
            not(requestHeader('if-modified-since')),
            not(requestHeader('if-unmodified-since')),
            not(requestHeader('if-range')),
          ),
        )
        // Add a precondition that, if (wrongly) evaluated, would fail with 412.
        .set(requestHeader('if-match'), constant('"thymian-no-match"'))
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
                  'A request whose unconditional response is non-2xx/412 returned 412 once an If-Match precondition was added. The server MUST ignore preconditions when the response would be non-2xx/412; the 412 shows the precondition was evaluated instead of ignored.',
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
