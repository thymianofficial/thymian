import { and, getHeader, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-should-not-generate-non-version-info-in-product-version',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender SHOULD NOT generate information in product-version that is not a version identifier (i.e., successive versions of the same product name ought to differ only in the product-version portion of the product identifier).',
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

        // Parse User-Agent for product tokens: product/version
        // RFC 9110: product = token ["/" product-version]
        const productTokens = userAgent.match(/([^\s/]+)\/([^\s)]+)/g);
        if (!productTokens) {
          return false;
        }

        for (const token of productTokens) {
          const [, version] = token.split('/');
          if (!version) continue;

          // Check if version contains non-version information
          // Valid versions typically contain: digits, dots, dashes, alphanumerics
          // Invalid: long text, spaces, special chars, descriptive text

          // Skip if it looks like a valid version (e.g., "1.0.0", "2.3", "1.0-beta", "v1.2.3")
          if (/^v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/.test(version)) {
            continue;
          }

          // Check for descriptive/non-version text indicators
          const nonVersionPatterns = [
            /[a-zA-Z]{10,}/, // Long text strings (likely descriptive)
            /\b(like|for|with|on|the|and|or)\b/i, // Common words
            /[,;:]/, // Unusual punctuation for versions
          ];

          if (nonVersionPatterns.some((pattern) => pattern.test(version))) {
            return true;
          }
        }

        return false;
      },
    ),
  )
  .done();
