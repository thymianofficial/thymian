import {
  getHeader,
  responseHeader,
  type RuleViolationLocation,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

/**
 * Parse a Content-Encoding field value into the list of applied content
 * codings (lower-cased, comma-separated, possibly across multiple header
 * lines).
 */
function parseContentEncoding(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((line) => line.split(','))
    .map((coding) => coding.trim().toLowerCase())
    .filter((coding) => coding.length > 0);
}

export default httpRule('rfc9110/content-encoding-should-not-include-identity')
  .severity('warn')
  .type('test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `The coding named "identity" is reserved for its special role in Accept-Encoding and thus SHOULD NOT be included in Content-Encoding.`,
  )
  .summary('Content-Encoding header SHOULD NOT include "identity" coding.')
  .explanation(
    'Do not list "identity" as a content coding in a Content-Encoding header. The token "identity" means "no encoding applied" and exists only for use in Accept-Encoding to say a client will accept an unencoded response; putting it in Content-Encoding is meaningless and can confuse recipients that try to decode it. If nothing was applied, simply omit the header rather than declaring the identity coding.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-encoding'),
      (_req, res, location: RuleViolationLocation) => {
        const contentEncoding = getHeader(res.headers, 'content-encoding');

        if (contentEncoding === undefined) {
          return [];
        }

        const codings = parseContentEncoding(contentEncoding);

        if (!codings.includes('identity')) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'The Content-Encoding header lists the "identity" coding.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
