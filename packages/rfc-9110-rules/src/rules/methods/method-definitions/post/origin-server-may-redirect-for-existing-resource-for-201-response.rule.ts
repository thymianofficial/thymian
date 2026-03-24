import { and, method, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .description(
    "If the result of processing a POST would be equivalent to a representation of an existing resource, an origin server MAY redirect the user agent to that resource by sending a 303 (See Other) response with the existing resource's identifier in the Location field.",
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('POST'), statusCode(201)),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(and(method('POST'), statusCode(201)))
        .run()
        .skipIf(not(statusCode(201)))
        .replayStep((step) => step.run().done())
        .transactions(([, transaction]) => {
          if (transaction.response.statusCode !== 303) {
            ctx.reportViolation({
              location: {
                elementType: 'edge',
                elementId: transaction.source.transactionId,
              },
            });
          }
        })
        .done(),
    ),
  )
  .done();
