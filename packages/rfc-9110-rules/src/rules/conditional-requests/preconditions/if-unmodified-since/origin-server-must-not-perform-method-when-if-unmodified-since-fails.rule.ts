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
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-unmodified-since-fails',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Unmodified-Since fails; MUST respond with 412 or 2xx.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-unmodified-since', '412')
  .rule((ctx) =>
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
