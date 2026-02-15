import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';
import { singleTestCase } from '@thymian/http-testing';

import { compareETags, parseConditionalETagHeader } from '../../utils.js';

export default httpRule(
  'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'An origin server that evaluates an If-None-Match condition MUST NOT perform the requested method if the condition evaluates to false; instead, the origin server MUST respond with either a) the 304 (Not Modified) status code if the request method is GET or HEAD or b) the 412 (Precondition Failed) status code for all other request methods.',
  )
  .summary(
    'Origin server MUST respond with 304 for GET/HEAD or 412 for other methods when If-None-Match fails.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-none-match', '304', '412')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('if-none-match'), responseHeader('etag')),
      (req, res) => {
        const ifNoneMatch = getHeader(req.headers, 'if-none-match');
        const etag = getHeader(res.headers, 'etag');

        if (
          typeof ifNoneMatch !== 'string' ||
          typeof etag !== 'string' ||
          !etag
        ) {
          return false;
        }

        const requestedETags = parseConditionalETagHeader(ifNoneMatch);

        // If-None-Match evaluates to false (i.e., fails) when there IS a match
        // Using weak comparison per RFC 9110 section 13.1.2
        const hasMatch =
          requestedETags.includes('*') ||
          requestedETags.some((requestedETag) =>
            compareETags(requestedETag, etag, true),
          );

        if (hasMatch) {
          // Precondition failed - check response status
          const isGetOrHead =
            req.method?.toUpperCase() === 'GET' ||
            req.method?.toUpperCase() === 'HEAD';

          if (isGetOrHead && res.statusCode !== 304) {
            return {
              message: `If-None-Match precondition failed (ETag matches), but server responded with ${res.statusCode} instead of 304 Not Modified for ${req.method} request.`,
            };
          }

          if (!isGetOrHead && res.statusCode !== 412) {
            return {
              message: `If-None-Match precondition failed (ETag matches), but server responded with ${res.statusCode} instead of 412 Precondition Failed for ${req.method} request.`,
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
          not(or(responseHeader('etag'), responseHeader('last-modified'))),
          '200 OK response does not include ETag or Last-Modified header.',
        )
        .replayStep((step) =>
          step
            .set(requestHeader('if-none-match'), responseHeader('etag'))
            .run({ expectStatusCode: 304 })
            .done(),
        )
        .done(),
    ),
  )
  .done();
