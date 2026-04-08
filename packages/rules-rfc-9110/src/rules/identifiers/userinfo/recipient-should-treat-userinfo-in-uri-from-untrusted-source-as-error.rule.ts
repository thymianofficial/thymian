import { or, protocol } from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      or(protocol('http'), protocol('https')),
      (req, res) => {
        try {
          const url = new URL(req.path, req.origin);

          return (
            (!!url.username || !!url.password) &&
            !(res.statusCode >= 400 && res.statusCode < 500)
          );
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return false;
        }
      },
    ),
  )
  .done();
