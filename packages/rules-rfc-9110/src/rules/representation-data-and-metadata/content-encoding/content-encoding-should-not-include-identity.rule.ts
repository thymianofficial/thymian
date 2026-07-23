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
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `The coding named "identity" is reserved for its special role in Accept-Encoding and thus SHOULD NOT be included in Content-Encoding.`,
  )
  .summary('Content-Encoding header SHOULD NOT include "identity" coding.')
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
                'The Content-Encoding header lists the "identity" coding. "identity" is reserved for its special role in Accept-Encoding and SHOULD NOT be included in Content-Encoding.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
