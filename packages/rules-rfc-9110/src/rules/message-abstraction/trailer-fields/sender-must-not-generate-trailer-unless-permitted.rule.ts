import { responseTrailer } from '@thymian/core';
import { httpRule } from '@thymian/core';

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

// Implemented (outcome 1): a response-side MUST NOT that needs only the trailer
// field *names* (does a forbidden field appear in the trailers?). The single
// `analytics` type infers AnalyzeContext; `validateCommonHttpTransactions`
// exposes `res.trailers` as the trailer-name list (Object.keys of the trailer
// section), which is exactly what this check requires. Names are compared
// case-insensitively. Scoped to the response sender via
// `appliesTo('server','origin server')` so it fires on HAR responses, whose
// role defaults to `origin server`.
export default httpRule(
  'rfc9110/sender-must-not-generate-trailer-unless-permitted',
)
  .severity('error')
  .type('analytics')
  .appliesTo('server', 'origin server')
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
      (_req, res, location) => {
        // In the common projection `res.trailers` is the list of trailer field
        // NAMES (string[]); iterate it directly rather than via Object.keys.
        const forbiddenTrailers = (res.trailers ?? []).filter((name) =>
          FORBIDDEN_TRAILER_FIELDS.has(name.toLowerCase()),
        );

        if (forbiddenTrailers.length > 0) {
          return [
            {
              location,
              violation: {
                message: `Response contains forbidden trailer field(s): ${forbiddenTrailers.join(', ')}. These fields cannot be sent in trailers.`,
              },
              findings: [],
            },
          ];
        }

        return [];
      },
    ),
  )
  .done();
