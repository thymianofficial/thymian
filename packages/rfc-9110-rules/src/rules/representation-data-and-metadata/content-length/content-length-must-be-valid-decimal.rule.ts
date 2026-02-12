import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/content-length-must-be-valid-decimal')
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server', 'client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `Content-Length field value must conform to the ABNF: Content-Length = 1*DIGIT.
    A sender MUST NOT forward a message with a Content-Length header field value that does not match the ABNF.
    The field value must be a string of decimal digits representing the number of octets in the message content.`,
  )
  .summary('Content-Length must be a valid decimal number (1*DIGIT).')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('content-length'),
      (req, res, location) => {
        const contentLengthHeader = res.headers.find((h: string) =>
          h.toLowerCase().startsWith('content-length:'),
        );

        if (!contentLengthHeader) {
          return false;
        }

        const value = contentLengthHeader.split(':', 2)[1]?.trim();

        if (!value) {
          return {
            message: 'Content-Length header has no value',
            location,
          };
        }

        // Check ABNF: 1*DIGIT (one or more decimal digits)
        if (!/^\d+$/.test(value)) {
          return {
            message: `Content-Length value "${value}" does not match ABNF (must be 1*DIGIT)`,
            location,
          };
        }

        // Check for leading zeros (technically valid but unusual)
        if (value.length > 1 && value.startsWith('0')) {
          return {
            message: `Content-Length value "${value}" has leading zeros (unusual but technically valid)`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
