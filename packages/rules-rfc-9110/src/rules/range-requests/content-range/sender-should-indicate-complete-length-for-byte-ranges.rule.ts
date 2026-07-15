import type { RuleViolationLocation } from '@thymian/core';
import { getHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

// A multipart (multipart/byteranges) 206 carries Content-Range in each body
// part and MUST NOT repeat it in the header section (RFC 9110 Section 15.3.7.2),
// so the header-level complete-length check does not apply to it.
function isMultipartByteranges(
  contentType: string | string[] | undefined,
): boolean {
  const value = Array.isArray(contentType)
    ? contentType.join(',')
    : contentType;

  return typeof value === 'string' && /multipart\/byteranges/i.test(value);
}

export default httpRule(
  'rfc9110/sender-should-indicate-complete-length-for-byte-ranges',
)
  .severity('warn')
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'For byte ranges, a sender SHOULD indicate the complete length of the representation from which the range has been extracted, unless the complete length is unknown or difficult to determine. An asterisk character ("*") in place of the complete-length indicates that the representation length was unknown when the header field was generated.',
  )
  .summary(
    'Sender should indicate complete length in Content-Range unless unknown.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      statusCode(206),
      (_req, res, location: RuleViolationLocation) => {
        // Multipart 206 responses carry Content-Range per body part, not in the
        // header section, so there is nothing to check at the header level.
        if (isMultipartByteranges(getHeader(res.headers, 'content-type'))) {
          return [];
        }

        const contentRange = getHeader(res.headers, 'content-range');
        const value = Array.isArray(contentRange)
          ? contentRange[0]
          : contentRange;

        // A single-part 206 MUST carry Content-Range; without it the sender has
        // indicated no complete length at all.
        if (typeof value !== 'string' || value.trim() === '') {
          return [
            {
              location,
              violation: {
                message:
                  'A single-part 206 response omits Content-Range, indicating no complete length. Send "bytes first-last/complete-length" (or ".../*" if the length is unknown).',
              },
              findings: [],
            },
          ];
        }

        // Only byte-range responses are in scope.
        if (!/^bytes\b/i.test(value.trim())) {
          return [];
        }

        // A conformant byte-range Content-Range ends with a numeric
        // complete-length or "*" (explicitly unknown). Anything else omits it.
        return /bytes\s+\d+-\d+\/(\d+|\*)/i.test(value)
          ? []
          : [
              {
                location,
                violation: {
                  message: `The 206 response's Content-Range ("${value.trim()}") does not indicate the complete length. Include the complete-length, or "*" if it is genuinely unknown.`,
                },
                findings: [],
              },
            ];
      },
    ),
  )
  .done();
