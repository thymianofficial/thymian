import { httpRule, statusCode } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-recipient-should-support-8000-octet-uris',
)
  .severity('warn')
  // Response-/recipient-side rule (outcome 1, already implemented). The
  // observable non-conformance is a recipient returning 414 (URI Too Long) for a
  // request whose URI is at or below the RECOMMENDED 8000-octet minimum — i.e.
  // the recipient failed to support a URI it should have. This is server
  // behavior under real load, not meaningful in `test` (Thymian does not
  // generate over-length URIs) nor in `lint`; it stays `analytics`. appliesTo
  // includes `origin server` so the analyze role filter matches HAR responses;
  // `server` is kept for non-HAR captures.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-uri-references')
  .description(
    'It is RECOMMENDED that all senders and recipients support, at a minimum, URIs with lengths of 8000 octets in protocol elements.',
  )
  .appliesTo('origin server', 'server')
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
