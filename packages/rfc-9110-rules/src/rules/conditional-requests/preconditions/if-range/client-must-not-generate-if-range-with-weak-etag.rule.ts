import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { isWeakETag } from '../../utils.js';

export default httpRule(
  'rfc9110/client-must-not-generate-if-range-with-weak-etag',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field containing an entity tag that is marked as weak.',
  )
  .summary('Client MUST NOT generate If-Range with weak entity tag.')
  .appliesTo('client')
  .tags('conditional-requests', 'if-range', 'etag', 'weak')
  .rule((ctx) => ctx.validateCommonHttpTransactions(requestHeader('if-range')))
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-range'), (req) => {
      const ifRange = getHeader(req.headers, 'if-range');

      if (typeof ifRange === 'string') {
        return false;
      }

      const ranges = Array.isArray(ifRange) ? ifRange : [ifRange];

      const invalidRanges = ranges.filter(
        (range) => range && range.trim().match(/^[Ww]?"/),
      );

      if (invalidRanges.length > 0) {
        return {
          message: `If-Range header field contains a weak entity tag (marked with W/), which is not allowed. Value(s) used: ${invalidRanges.join(', ')}`,
        };
      }

      return false;
    }),
  )
  .done();
