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
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender MUST NOT generate advertising or other nonessential information within the product identifier.',
  )
  .explanation(
    'Keep the product identifiers in your User-Agent limited to what actually names the software and its significant components. Do not stuff in marketing slogans, promotional URLs, or other nonessential text. Servers rely on the User-Agent to identify clients, tailor responses, and drive analytics, so padding it with advertising pollutes those signals, bloats every request, and increases both latency and the risk of fingerprinting the user.',
  )
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
                  message: `The User-Agent header value "${userAgent}" appears to contain advertising or other nonessential information.`,
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
