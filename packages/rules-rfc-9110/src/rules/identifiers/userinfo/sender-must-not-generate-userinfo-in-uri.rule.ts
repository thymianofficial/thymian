import type { RuleViolationLocation } from '@thymian/core';
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
  .explanation(
    'When a sender puts an http or https URI into a message, whether as the request target or inside a header value, it must not include the userinfo part (the user:password@ segment, along with its @ delimiter) before the host. Userinfo in HTTP URIs is deprecated because embedding credentials this way can leak passwords and is a common trick for disguising the real host in phishing. Leaving it out keeps URIs safe to display and reason about and avoids exposing authentication details.',
  )
  .appliesTo('client')
  .rule((ctx, opts, logger) =>
    ctx.validateCommonHttpTransactions(
      or(protocol('http'), protocol('https')),
      (req, _res, location: RuleViolationLocation) => {
        try {
          const url = new URL(req.target ?? req.path, req.origin);

          return !!url.username || !!url.password
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
