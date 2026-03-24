import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';
import { singleTestCase } from '@thymian/http-testing';

import { compareETags, parseConditionalETagHeader } from '../../utils.js';

export default httpRule(
  'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
)
  .severity('error')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An origin server that evaluates an If-None-Match condition MUST NOT perform the requested method if the condition evaluates to false; instead, the origin server MUST respond with either a) the 304 (Not Modified) status code if the request method is GET or HEAD or b) the 412 (Precondition Failed) status code for all other request methods.',
  )
  .summary(
    'Origin server MUST respond with 304 for GET/HEAD or 412 for other methods when If-None-Match fails.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-none-match', '304', '412')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-none-match'),
        or(
          and(
            or(method('GET'), method('HEAD')),
            not(responseWith(statusCode(304))),
          ),
          and(
            not(or(method('GET'), method('HEAD'))),
            not(responseWith(statusCode(412))),
          ),
        ),
      ),
    ),
  )
  .overrideTest((ctx) =>
    ctx.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(or(method('GET'), method('HEAD')), statusCode(200)),
        )
        .run()
        .skipIf(
          not(or(responseHeader('etag'), responseHeader('last-modified'))),
          '200 OK response does not include ETag or Last-Modified header.',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
            .run()
            .done(),
        )
        .transactions(([, notModifiedTransaction]) => {
          if (notModifiedTransaction.response.statusCode !== 304) {
            ctx.reportViolation({
              location: {
                elementType: 'edge',
                elementId: notModifiedTransaction.source.transactionId,
              },
            });
          }
        })
        .done(),
    ),
  )
  .done();
