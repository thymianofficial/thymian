import { and, getHeader, requestHeader } from '@thymian/core';
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
  .appliesTo('client')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(requestHeader('user-agent')),
      (request) => {
        const userAgent = getHeader(request.headers, 'user-agent');
        if (typeof userAgent !== 'string') {
          return false;
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

        return advertisingKeywords.some((pattern) => pattern.test(userAgent));
      },
    ),
  )
  .done();
