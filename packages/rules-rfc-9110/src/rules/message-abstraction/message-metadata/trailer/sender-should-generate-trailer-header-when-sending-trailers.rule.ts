import { not, responseHeader, type RuleViolationLocation } from '@thymian/core';
import { httpRule } from '@thymian/core';

// Implemented (outcome 1): a response-side server-behavior SHOULD. The
// `analytics,test` union infers LiveApiContext, so the callback reads the live
// response and can inspect the actual trailer fields. A response that carries
// trailer fields but no Trailer header in its header section is the observable
// non-conformance. It is response-side (the server is the sender of the
// response trailers), so `test` is meaningful and `appliesTo('server','origin
// server')` lets it fire on HAR (responses default to the `origin server`
// role).
export default httpRule(
  'rfc9110/sender-should-generate-trailer-header-when-sending-trailers',
)
  .severity('warn')
  .type('analytics', 'test')
  .appliesTo('server', 'origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.2')
  .description(
    'A sender that intends to generate one or more trailer fields in a message SHOULD generate a Trailer header field in the header section of that message to indicate which fields might be present in the trailers.',
  )
  .summary(
    'Senders SHOULD generate Trailer header when sending trailer fields.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      not(responseHeader('trailer')),
      (_req, res, location: RuleViolationLocation) => {
        const trailerKeys = Object.keys(res.trailers);

        if (trailerKeys.length > 0) {
          return [
            {
              location,
              violation: {
                message: `Response contains trailer fields (${trailerKeys.join(', ')}) but no Trailer header field was sent`,
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
