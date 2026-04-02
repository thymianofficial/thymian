import { httpTransactionToLabel, not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-generate-trailer-header-when-sending-trailers',
)
  .severity('warn')
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.2')
  .description(
    'A sender that intends to generate one or more trailer fields in a message SHOULD generate a Trailer header field in the header section of that message to indicate which fields might be present in the trailers.',
  )
  .summary(
    'Senders SHOULD generate Trailer header when sending trailer fields.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(not(responseHeader('trailer')), (req, res) => {
      const trailerKeys = Object.keys(res.trailers);

      if (trailerKeys.length > 0) {
        return {
          message: `Response contains trailer fields (${trailerKeys.join(', ')}) but no Trailer header field was sent`,
          location: httpTransactionToLabel(req, res),
        };
      }

      return false;
    }),
  )
  .done();
