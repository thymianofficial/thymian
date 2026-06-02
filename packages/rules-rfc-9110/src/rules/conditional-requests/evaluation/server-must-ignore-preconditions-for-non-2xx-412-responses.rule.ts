import {
  and,
  constant,
  not,
  or,
  requestHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-preconditions-for-non-2xx-412-responses',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server MUST ignore all received preconditions if its response to the same request without those conditions, prior to processing the request content, would have been a status code other than a 2xx (Successful) or 412 (Precondition Failed). In other words, redirects and failures that can be detected before significant processing occurs take precedence over the evaluation of preconditions.',
  )
  .summary('Server MUST ignore preconditions if response would be non-2xx/412.')
  .appliesTo('server')
  .tags('conditional-requests', 'evaluation', 'precedence')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(
          requestHeader('if-match'),
          requestHeader('if-none-match'),
          requestHeader('if-modified-since'),
          requestHeader('if-unmodified-since'),
          requestHeader('if-range'),
        ),
        not(or(statusCodeRange(200, 299), statusCode(412))),
      ),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          not(or(statusCodeRange(200, 299), statusCode(412))),
        )
        .run()
        .replayStep((step) =>
          step
            .set(requestHeader('if-match'), constant('"qupaya"'))
            .run()
            .done(),
        )
        .transactions(([baseline, withPrecondition]) => {
          if (
            withPrecondition.response.statusCode !==
            baseline.response.statusCode
          ) {
            ctx.reportViolation({
              location: {
                elementType: 'edge',
                elementId: withPrecondition.source.transactionId,
              },
              message:
                'Server did not ignore preconditions for a request whose unconditional response is non-2xx/412: status changed from ' +
                baseline.response.statusCode +
                ' to ' +
                withPrecondition.response.statusCode +
                ' when an If-Match precondition was added.',
            });
          }
        })
        .done(),
    ),
  )
  .done();
