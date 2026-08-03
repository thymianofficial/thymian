import {
  httpRule,
  or,
  protocol,
  type RuleViolationLocation,
} from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
)
  .severity('warn')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    `A recipient SHOULD parse for userinfo and treat its presence as an error; it is likely being used to obscure the authority for the sake of phishing attacks.`,
  )
  .explanation(
    'Before acting on an http or https URI that came from an untrusted source, a recipient should check for a userinfo part (the user:password@ segment before the host) and treat its presence as an error. The userinfo component is deprecated in HTTP URIs, and when present it is commonly used to hide the real host so a link looks like it points somewhere trustworthy. Rejecting such URIs helps defend users against phishing that disguises the true authority.',
  )
  .appliesTo('server')
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
