import {
  and,
  getHeader,
  not,
  or,
  requestHeader,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { compareHttpDates, isValidHttpDate } from '../../utils.js';

export default httpRule(
  'rfc9110/origin-server-must-not-perform-method-when-if-unmodified-since-fails',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .summary(
    'Origin server MUST NOT perform method when If-Unmodified-Since fails; MUST respond with 412 or 2xx.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-unmodified-since', '412')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        requestHeader('if-unmodified-since'),
        not(requestHeader('if-match')),
        responseHeader('last-modified'),
      ),
      (req, res) => {
        const ifUnmodifiedSince = getHeader(req.headers, 'if-unmodified-since');
        const lastModified = getHeader(res.headers, 'last-modified');

        if (
          typeof ifUnmodifiedSince !== 'string' ||
          typeof lastModified !== 'string' ||
          !isValidHttpDate(ifUnmodifiedSince) ||
          !isValidHttpDate(lastModified)
        ) {
          return false;
        }

        // If-Unmodified-Since evaluates to false (i.e., fails) when
        // the resource HAS been modified (lastModified > ifUnmodifiedSince)
        const comparison = compareHttpDates(lastModified, ifUnmodifiedSince);

        if (comparison !== null && comparison > 0) {
          // Resource was modified - should return 412 or 2xx
          const is412 = res.statusCode === 412;
          const is2xx = res.statusCode >= 200 && res.statusCode < 300;

          if (!is412 && !is2xx) {
            return {
              message: `If-Unmodified-Since precondition failed (resource modified since ${ifUnmodifiedSince}), but server responded with ${res.statusCode} instead of 412 Precondition Failed or 2xx status code.`,
            };
          }
        }

        return false;
      },
    ),
  )
  .done();
