import {
  constant,
  httpRule,
  method,
  requestHeader,
  type RuleFnResult,
  singleTestCase,
} from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-400-for-unsupported-partial-put',
)
  .severity('warn')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-partial-put')
  .description(
    'An origin server SHOULD respond with a 400 (Bad Request) status code if it receives Content-Range on a PUT for a target resource that does not support partial PUT requests.',
  )
  .summary(
    'Origin server should respond with 400 to a Content-Range PUT on a resource that does not support partial PUT.',
  )
  .appliesTo('origin server')
  .tags('range-requests', 'partial-put', '400')
  // Static: a PUT operation that declares no 206 response does not support
  // partial PUT, so it SHOULD also declare a 400 for the Content-Range-on-PUT
  // case. Anchored on the operation's first declared response so it is flagged
  // at most once.
  .overrideStaticRule((ctx) =>
    ctx.validateHttpTransactions(
      (req, res, responses) =>
        req.method.toUpperCase() === 'PUT' &&
        responses.length > 0 &&
        res === responses[0] &&
        !responses.some((response) => response.statusCode === 206) &&
        !responses.some((response) => response.statusCode === 400),
      () => ({
        violation: {
          message:
            'This PUT operation declares no 206 response (no partial-PUT support) and no 400 response. An origin server SHOULD answer a Content-Range PUT it does not support with 400 (Bad Request); declare that response.',
        },
        findings: [],
      }),
    ),
  )
  // Test: replay each captured PUT with an added Content-Range request header. A
  // server that does not support partial PUT SHOULD answer 400; a 206 means it
  // does support it (also conformant). Any other status is a violation.
  .overrideTest(async (ctx) => {
    const results: RuleFnResult[] = [];

    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(method('PUT'))
        .run()
        .replayStep((step) =>
          step
            .set(requestHeader('content-range'), constant('bytes 0-0/*'))
            .run({ checkStatusCode: false })
            .done(),
        )
        .transactions(([, ranged]) => {
          const status = ranged.response.statusCode;

          if (status !== 400 && status !== 206) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: ranged.source.transactionId,
              },
              violation: {
                message: `A PUT carrying Content-Range returned ${status}. An origin server that does not support partial PUT SHOULD respond 400 (Bad Request).`,
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
