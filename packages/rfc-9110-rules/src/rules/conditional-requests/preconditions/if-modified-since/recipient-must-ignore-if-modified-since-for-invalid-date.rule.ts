import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { isValidHttpDate } from '../../utils.js';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-for-invalid-date',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the received field value is not a valid HTTP-date, or if the field value has more than one member.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since if value is not a valid HTTP-date or has multiple members.',
  )
  .appliesTo('server', 'cache')
  .tags('conditional-requests', 'if-modified-since', 'date-validation')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-modified-since'), (req) => {
      const ifModifiedSince = getHeader(req.headers, 'if-modified-since');

      if (typeof ifModifiedSince !== 'string') {
        return false;
      }

      // Check for multiple members (comma-separated values)
      if (ifModifiedSince.includes(',')) {
        const parts = ifModifiedSince.split(',').map((s) => s.trim());
        // If more than 3 parts, it's likely multiple dates (HTTP dates have 2 commas)
        if (parts.length > 3) {
          return {
            message:
              'If-Modified-Since header field has more than one member (multiple dates).',
          };
        }
      }

      // Check if it's a valid HTTP-date
      if (!isValidHttpDate(ifModifiedSince)) {
        return {
          message:
            'If-Modified-Since header field value is not a valid HTTP-date.',
        };
      }

      return false;
    }),
  )
  .done();
