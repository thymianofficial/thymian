import {
  getHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { parseContentRange } from './utils.js';

export default httpRule(
  'rfc9110/recipient-must-not-recombine-invalid-content-range',
)
  .severity('error')
  // The recipient's recombination decision is internal, but the precondition it
  // guards — a sender emitting a structurally invalid Content-Range (last-pos <
  // first-pos, or complete-length <= last-pos) — is fully visible on the response
  // value.
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A Content-Range field value is invalid if it contains a range-resp that has a last-pos value less than its first-pos value, or a complete-length value less than or equal to its last-pos value. The recipient of an invalid Content-Range MUST NOT attempt to recombine the received content with a stored representation.',
  )
  .summary(
    'Recipient must not recombine content with invalid Content-Range values.',
  )
  .explanation(
    'A Content-Range is nonsensical if its range runs backwards (last byte before first byte) or claims a total length that is not bigger than the last byte it reports. When you receive one like that, do not stitch the partial content back into any copy you already hold. Trusting an impossible range would corrupt the reassembled representation, so the safe move is to reject it rather than merge garbage into stored data.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-range'),
      (_req, res, location: RuleViolationLocation) => {
        // Read the header case-insensitively (HAR lowercases names; generated
        // traffic may preserve original casing).
        const contentRange = getHeader(res.headers, 'content-range');

        if (!contentRange) {
          return [];
        }

        const ranges = parseContentRange(contentRange);

        const invalid = ranges.filter(
          (range) =>
            range.end < range.start ||
            (range.size !== null && range.size <= range.end),
        );

        if (invalid.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The response carries an invalid Content-Range: ${invalid
                .map(
                  (range) =>
                    `${range.unit} ${range.start}-${range.end}/${
                      range.size ?? '*'
                    }`,
                )
                .join(', ')}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
