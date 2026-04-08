import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-recipient-should-support-8000-octet-uris',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-uri-references')
  .description(
    'It is RECOMMENDED that all senders and recipients support, at a minimum, URIs with lengths of 8000 octets in protocol elements.',
  )
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(statusCode(414), (req) => {
      try {
        const url = new URL(req.path, req.origin);

        if (new TextEncoder().encode(url.toString()).length <= 8000) {
          return {
            message: 'URI length is less than 8000 octets',
          };
        }
      } catch (e) {
        logger.error('Cannot run rule because of invalid URL:', e);
      }

      return false;
    }),
  )
  .done();
