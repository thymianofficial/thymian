import { httpRule, or, protocol } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
)
  .severity('warn')
  // Response-/recipient-side rule (outcome 1, already implemented). The
  // observable non-conformance is a recipient that accepted (did not reject with
  // a 4xx) a target URI carrying userinfo. This is server/recipient behavior, so
  // it is not meaningful in `test` (Thymian does not generate userinfo URIs) nor
  // in `lint`; it stays `analytics`. appliesTo includes `origin server` so the
  // analyze role filter matches HAR responses; `server` is kept for non-HAR
  // captures. Security-relevant: userinfo in a URI is a phishing/authority-
  // obfuscation vector (see PR security section).
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    `A recipient SHOULD parse for userinfo and treat its presence as an error; it is likely being used to obscure the authority for the sake of phishing attacks.`,
  )
  .appliesTo('origin server', 'server')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      or(protocol('http'), protocol('https')),
      (req, res, location) => {
        try {
          const url = new URL(req.target ?? req.path, req.origin);

          return (!!url.username || !!url.password) &&
            !(res.statusCode >= 400 && res.statusCode < 500)
            ? [{ location, violation: {}, findings: [] }]
            : [];
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return [];
        }
      },
    ),
  )
  .done();
