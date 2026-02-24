import { responseTrailer } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

// Fields that are forbidden in trailers per RFC 9110
const FORBIDDEN_TRAILER_FIELDS = new Set([
  'authorization',
  'cache-control',
  'content-encoding',
  'content-length',
  'content-range',
  'content-type',
  'host',
  'max-forwards',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'www-authenticate',
]);

export default httpRule(
  'rfc9110/sender-must-not-generate-trailer-unless-permitted',
)
  .severity('error')
  .type('static', 'analytics', 'test', 'informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1')
  .description(
    "Many fields cannot be processed outside the header section because their evaluation is necessary prior to receiving the content, such as those that describe message framing, routing, authentication, request modifiers, response controls, or content format. A sender MUST NOT generate a trailer field unless the sender knows the corresponding header field name's definition permits the field to be sent in trailers.",
  )
  .summary(
    'Senders MUST NOT generate trailer fields unless explicitly permitted by field definition.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseTrailer(),
      (req, res, location) => {
        const forbiddenTrailers = Object.keys(res.trailers || {}).filter(
          (key) => FORBIDDEN_TRAILER_FIELDS.has(key.toLowerCase()),
        );

        if (forbiddenTrailers.length > 0) {
          return {
            message: `Response contains forbidden trailer field(s): ${forbiddenTrailers.join(', ')}. These fields cannot be sent in trailers.`,
            location,
          };
        }

        return false;
      },
    ),
  )
  .done();
