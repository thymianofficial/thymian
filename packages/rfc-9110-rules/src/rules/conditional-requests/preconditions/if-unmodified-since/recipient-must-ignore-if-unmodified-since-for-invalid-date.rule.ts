import { getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { isValidHttpDate } from '../../utils.js';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-for-invalid-date',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore the If-Unmodified-Since header field if the received field value is not a valid HTTP-date (including when the field value appears to be a list of dates).',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since if value is not a valid HTTP-date.',
  )
  .appliesTo('server', 'cache')
  .tags('conditional-requests', 'if-unmodified-since', 'date-validation')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('if-unmodified-since'),
      (req) => {
        const ifUnmodifiedSince = getHeader(req.headers, 'if-unmodified-since');

        if (typeof ifUnmodifiedSince !== 'string') {
          return false;
        }

        // Check if it's a valid HTTP-date
        if (!isValidHttpDate(ifUnmodifiedSince)) {
          return {
            message:
              'If-Unmodified-Since header field value is not a valid HTTP-date.',
          };
        }

        return false;
      },
    ),
  )
  .done();
