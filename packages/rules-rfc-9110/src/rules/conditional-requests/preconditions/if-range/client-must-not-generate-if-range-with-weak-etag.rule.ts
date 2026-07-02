import {
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { isWeakETag } from '../../utils.js';

/**
 * A client must never put a *weak* entity tag in If-Range; unlike the HTTP-date
 * case this is unconditional, and weakness is fully observable from the request
 * header value (the `W/` marker). Because the constraint is on what the client
 * sends, it cannot run in `test` (Thymian generates the request) and has no
 * description to validate in `lint`; it is therefore analyze-only, scoped to the
 * client roles so it fires on HAR requests.
 */
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
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-range', 'etag', 'weak')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      requestHeader('if-range'),
      (req, _res, location: RuleViolationLocation) => {
        const ifRange = getHeader(req.headers, 'if-range');

        if (typeof ifRange === 'undefined') {
          return [];
        }

        const values = Array.isArray(ifRange) ? ifRange : [ifRange];

        // Only entity-tag values can be weak; HTTP-date values (covered by a
        // separate rule) start with a weekday name, not a W/ quoted tag.
        const weakTags = values.filter(
          (value) =>
            /^[Ww]\/\s*"/.test(value.trim()) && isWeakETag(value.trim()),
        );

        if (weakTags.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `The If-Range header field contains a weak entity tag (${weakTags.join(
                ', ',
              )}). Clients MUST NOT generate If-Range with a weak entity tag, since If-Range requires a strong validator.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
