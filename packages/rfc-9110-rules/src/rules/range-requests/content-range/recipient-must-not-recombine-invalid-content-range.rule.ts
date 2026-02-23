import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

import { parseContentRange } from './utils.js';

export default httpRule(
  'rfc9110/recipient-must-not-recombine-invalid-content-range',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A Content-Range field value is invalid if it contains a range-resp that has a last-pos value less than its first-pos value, or a complete-length value less than or equal to its last-pos value. The recipient of an invalid Content-Range MUST NOT attempt to recombine the received content with a stored representation.',
  )
  .summary(
    'Recipient must not recombine content with invalid Content-Range values.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-range'),
      (req, res) => {
        const contentRange = res.headers['content-range'];

        if (!contentRange) {
          return false;
        }

        const ranges = parseContentRange(contentRange);

        return ranges.some(
          (range) =>
            range.end < range.start || (range.size && range.size <= range.end),
        );
      },
    ),
  )
  .done();
