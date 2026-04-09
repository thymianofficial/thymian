import { httpRule, or, protocol } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-userinfo-in-uri')
  .severity('error')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    "A sender MUST NOT generate the userinfo subcomponent (and its '@' delimiter) when an 'http' or 'https' URI reference is generated within a message as a target URI or field value.",
  )
  .rule((ctx, opts, logger) =>
    ctx.validateCommonHttpTransactions(
      or(protocol('http'), protocol('https')),
      (req) => {
        try {
          const url = new URL(req.path, req.origin);

          return !!url.username || !!url.password;
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return false;
        }
      },
    ),
  )
  .done();
