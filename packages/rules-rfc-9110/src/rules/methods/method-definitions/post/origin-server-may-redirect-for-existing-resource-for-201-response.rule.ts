import { and, method, not, statusCode } from '@thymian/core';
import { httpRule, type RuleFnResult, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .description(
    "If the result of processing a POST would be equivalent to a representation of an existing resource, an origin server MAY redirect the user agent to that resource by sending a 303 (See Other) response with the existing resource's identifier in the Location field.",
  )
  .explanation(
    "When a POST would produce something equivalent to a resource that already exists, your origin server is allowed to answer with a 303 (See Other) pointing at that existing resource's URL via the Location field, instead of creating a duplicate. This matters because it hands the client a stable identifier and lets the representation be fetched with a cache-friendly GET, avoiding redundant copies at the cost of one extra round trip. It is optional, so this surfaces as advisory rather than a violation.",
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('POST'), statusCode(201)),
    ),
  )
  .overrideTest(async (ctx) => {
    const results: RuleFnResult[] = [];
    await ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(method('POST'), statusCode(201)))
        .run()
        .skipIf(not(statusCode(201)))
        .replayStep((step) => step.run().done())
        .transactions(([, transaction]) => {
          if (transaction.response.statusCode !== 303) {
            results.push({
              location: {
                elementType: 'edge',
                elementId: transaction.source.transactionId,
              },
              violation: {},
              findings: [],
            });
          }
        })
        .done(),
    );
    return results;
  })
  .done();
