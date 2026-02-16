import {
  and,
<<<<<<< mk/feat/rfc9110-conditional-requests
=======
  constant,
  getHeader,
>>>>>>> pm/feat/rfc9110-conditional-requests
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

import { compareHttpDates, isValidHttpDate } from '../../utils.js';

export default httpRule(
  'rfc9110/origin-server-should-respond-304-when-if-modified-since-false',
)
  .severity('warn')
  .type('static', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'An origin server that evaluates an If-Modified-Since condition SHOULD NOT perform the requested method if the condition evaluates to false; instead, the origin server SHOULD generate a 304 (Not Modified) response, including only those metadata that are useful for identifying or updating a previously cached response.',
  )
  .summary(
    'Origin server SHOULD respond with 304 when If-Modified-Since condition is false.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-modified-since', '304')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('GET'), method('HEAD')),
        requestHeader('if-modified-since'),
        not(requestHeader('if-none-match')),
        responseHeader('last-modified'),
      ),
      (req, res) => {
        const ifModifiedSince = getHeader(req.headers, 'if-modified-since');
        const lastModified = getHeader(res.headers, 'last-modified');

        if (
          typeof ifModifiedSince !== 'string' ||
          typeof lastModified !== 'string' ||
          !isValidHttpDate(ifModifiedSince) ||
          !isValidHttpDate(lastModified)
        ) {
          return false;
        }

        // If-Modified-Since evaluates to false (i.e., condition fails) when
        // the resource has NOT been modified (lastModified <= ifModifiedSince)
        const comparison = compareHttpDates(lastModified, ifModifiedSince);

        if (comparison !== null && comparison <= 0) {
          // Resource not modified - should return 304
          if (res.statusCode === 200) {
            return {
              message: `If-Modified-Since precondition failed (resource not modified since ${ifModifiedSince}), but server responded with 200 instead of 304 Not Modified.`,
            };
          }
        }

        return false;
      },
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
          not(responseHeader('last-modified')),
          'No Last-Modified header to test with',
        )
        .replayStep((step) =>
          step
            .set(
              requestHeader('if-modified-since'),
              responseHeader('last-modified'),
            )
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
