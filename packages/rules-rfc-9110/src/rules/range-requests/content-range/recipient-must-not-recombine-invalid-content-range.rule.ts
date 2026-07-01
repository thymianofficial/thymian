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
  // Implementable (outcome 1): the recipient's recombination decision is
  // internal, but the precondition it guards — a sender emitting a structurally
  // invalid Content-Range (last-pos < first-pos, or complete-length <= last-pos)
  // — is fully visible on the response VALUE. Response-side, so it is meaningful
  // in both `test` (Thymian observes the response) and `analyze`; read the VALUE
  // via getHeader on the real-data (LiveApiContext) validateHttpTransactions.
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A Content-Range field value is invalid if it contains a range-resp that has a last-pos value less than its first-pos value, or a complete-length value less than or equal to its last-pos value. The recipient of an invalid Content-Range MUST NOT attempt to recombine the received content with a stored representation.',
  )
  .summary(
    'Recipient must not recombine content with invalid Content-Range values.',
  )
  .appliesTo('origin server')
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
                .join(
                  ', ',
                )}. A range-resp with last-pos < first-pos, or complete-length <= last-pos, is invalid; any recipient MUST NOT attempt to recombine it with a stored representation.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
