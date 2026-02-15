import {
  and,
  getHeader,
  method,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { compareETags, parseConditionalETagHeader } from '../../utils.js';

export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-match-fails',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Match evaluates to false; MUST respond with 412 or 2xx.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', '412', 'precondition-failed')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('if-match'), responseHeader('etag')),
      (req, res) => {
        const ifMatch = getHeader(req.headers, 'if-match');
        const etag = getHeader(res.headers, 'etag');

        if (typeof ifMatch !== 'string' || typeof etag !== 'string' || !etag) {
          return false;
        }

        const requestedETags = parseConditionalETagHeader(ifMatch);

        // If-Match evaluates to false (i.e., fails) when there is NO match
        // Using strong comparison per RFC 9110 section 13.1.1
        const hasMatch =
          requestedETags.includes('*') ||
          requestedETags.some((requestedETag) =>
            compareETags(requestedETag, etag, false),
          );

        if (!hasMatch) {
          // Precondition failed - check response status
          const is412 = res.statusCode === 412;
          const is2xx = res.statusCode >= 200 && res.statusCode < 300;

          if (!is412 && !is2xx) {
            return {
              message: `If-Match precondition failed (no ETag match), but server responded with ${res.statusCode} instead of 412 Precondition Failed or 2xx status code.`,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
