import {
  and,
  getHeader,
  requestHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-advertising-in-product-identifier',
)
  .severity('error')
  // Request-side, analytics-only (#327): needs the User-Agent *value* (only on
  // recorded traffic via the live request model). Not `test` (Thymian generates
  // the request) nor `static` (value not in the common projection).
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender MUST NOT generate advertising or other nonessential information within the product identifier.',
  )
  // Request-side: HAR requests default to the `user-agent` role.
  .appliesTo('client', 'user-agent')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('user-agent')),
      (request, _res, location: RuleViolationLocation) => {
        const userAgent = getHeader(request.headers, 'user-agent');
        if (typeof userAgent !== 'string') {
          return [];
        }

        // Check for common advertising/promotional keywords
        const advertisingKeywords = [
          /\bvisit\s+(?:our\s+)?(?:website|site)\b/i,
          /\bdownload\s+(?:now|free|here)\b/i,
          /\bclick\s+here\b/i,
          /\bfree\s+trial\b/i,
          /\bbuy\s+now\b/i,
          /\bspecial\s+offer\b/i,
          /\blimited\s+time\b/i,
          /\bget\s+it\s+(?:now|free|here)\b/i,
          /https?:\/\/[^\s)]+\.(com|net|org|io)(?!\/[a-zA-Z0-9-]+$)/i, // URLs that look promotional (not just domain/path)
        ];

        return advertisingKeywords.some((pattern) => pattern.test(userAgent))
          ? [
              {
                location,
                violation: {
                  message: `The User-Agent header value "${userAgent}" appears to contain advertising or other nonessential information. A sender MUST NOT generate advertising within the product identifier.`,
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
