import { httpRule, statusCode } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-recipient-should-support-8000-octet-uris',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-uri-references')
  .description(
    'It is RECOMMENDED that all senders and recipients support, at a minimum, URIs with lengths of 8000 octets in protocol elements.',
  )
  .explanation(
    'Both clients and servers should be able to handle URIs at least 8000 octets long wherever URIs appear, such as request targets, without truncating or rejecting them for size alone. If an implementation caps URIs below this floor, long but legitimate URLs (deep paths, large query strings) fail unpredictably from one endpoint to another. A common minimum lets senders and recipients interoperate reliably instead of guessing how much URL each side will tolerate.',
  )
  .appliesTo('server')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(statusCode(414), (req, _res, location) => {
      try {
        const url = new URL(req.path, req.origin);

        if (new TextEncoder().encode(url.toString()).length <= 8000) {
          return [
            {
              location,
              violation: { message: 'URI length is less than 8000 octets' },
              findings: [],
            },
          ];
        }
      } catch (e) {
        logger.error('Cannot run rule because of invalid URL:', e);
      }

      return [];
    }),
  )
  .done();
