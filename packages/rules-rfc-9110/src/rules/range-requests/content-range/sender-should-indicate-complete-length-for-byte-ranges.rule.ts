import type { RuleViolationLocation } from '@thymian/core';
import { and, getHeader, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-indicate-complete-length-for-byte-ranges',
)
  .severity('warn')
  // Implementable (outcome 1): a response-side, server-behavior check on the
  // 206 Content-Range the server sends. Thymian is the sender during `test`
  // and the response is observed, so the check is meaningful in both `test`
  // and `analyze`. Read on `LiveApiContext` via getHeader so header VALUES are
  // available. `*` is the sanctioned marker for an unknown complete-length and
  // is treated as conformant; only a byte-range Content-Range that omits the
  // complete-length form entirely is flagged.
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'For byte ranges, a sender SHOULD indicate the complete length of the representation from which the range has been extracted, unless the complete length is unknown or difficult to determine. An asterisk character ("*") in place of the complete-length indicates that the representation length was unknown when the header field was generated.',
  )
  .summary(
    'Sender should indicate complete length in Content-Range unless unknown.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(206), responseHeader('content-range')),
      (_req, res, location: RuleViolationLocation) => {
        const contentRange = getHeader(res.headers, 'content-range');

        if (typeof contentRange !== 'string') {
          return [];
        }

        // Only byte-range responses are in scope. A conformant byte-range
        // Content-Range ends with either a numeric complete-length or "*"
        // (explicitly unknown). Anything else omits the complete-length the
        // sender SHOULD provide. Match case-insensitively ("bytes").
        if (!/^bytes\b/i.test(contentRange.trim())) {
          return [];
        }

        return !/bytes\s+\d+-\d+\/(\d+|\*)/i.test(contentRange)
          ? [
              {
                location,
                violation: {
                  message: `The 206 response's Content-Range ("${contentRange.trim()}") does not indicate the complete length of the representation. A byte-range sender SHOULD include the complete-length (or "*" if it is genuinely unknown).`,
                },
                findings: [],
              },
            ]
          : [];
      },
    ),
  )
  .done();
