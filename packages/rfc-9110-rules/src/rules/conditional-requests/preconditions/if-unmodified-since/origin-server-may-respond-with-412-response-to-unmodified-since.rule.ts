// origin-server-may-respond-with-412-response-to-unmodified-since

import {
  and,
  constant,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';
import { singleTestCase } from '@thymian/http-testing';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since',
)
  .severity('hint')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .summary(
    'An origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .appliesTo('origin server')
  .tags(
    'conditional-requests',
    'if-unmodified-since',
    '412',
    'precondition-failed',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('if-unmodified-since'),
      not(responseWith(statusCode(412))),
    ),
  )
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
        .expectForTransactions(statusCode(412))
        .done(),
    ),
  )
  .done();
