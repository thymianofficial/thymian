import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCodeRange,
} from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-unmodified-since-fails',
)
  .severity('error')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Unmodified-Since fails; MUST respond with 412 or 2xx.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-unmodified-since', '412')
  // TODO: Implement analytics-specific validation for If-Unmodified-Since failure detection.
  // In analytics mode, this should check recorded traffic for transactions where
  // If-Unmodified-Since was sent without If-Match, and the server responded with a success
  // status when it should have responded 412 (by comparing If-Unmodified-Since against the
  // resource's observed Last-Modified / known state). validateCommonHttpTransactions is
  // per-transaction and would false-positive on compliant 2xx responses, so no analytics
  // rule is registered until that correlation exists.
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(
            requestHeader('if-unmodified-since'),
            not(requestHeader('if-match')),
            or(method('GET'), method('HEAD')),
          ),
        )
        .run()
        .skipIf(not(responseHeader('last-modified')), 'No Last-Modified header')
        .replayStep((step) =>
          step
            .set(requestHeader('if-unmodified-since'), (response) => {
              const lastModifiedHeader = getHeader(
                response.headers,
                'last-modified',
              );

              if (typeof lastModifiedHeader === 'string') {
                const date = new Date(lastModifiedHeader);

                date.setSeconds(date.getSeconds() - 10);

                return date.toUTCString();
              }

              return lastModifiedHeader;
            })
            .run()
            .done(),
        )
        .expectForTransactions(statusCodeRange(400, 499))
        .done(),
    ),
  )
  .done();
