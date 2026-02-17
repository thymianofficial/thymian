import { and, getHeader, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

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
      and(statusCode(206), responseHeader('content-range')),
      (req, res) => {
        const contentRange = getHeader(res.headers, 'content-range');

        if (typeof contentRange !== 'string') {
          return false;
        }

        // Check if Content-Range ends with /* (unknown length) or has a specific length
        return !contentRange.match(/bytes \d+-\d+\/(\d+|\*)/);
      },
    ),
  )
  .done();
