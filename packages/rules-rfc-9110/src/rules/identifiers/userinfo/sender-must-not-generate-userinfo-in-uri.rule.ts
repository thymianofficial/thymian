import type { RuleViolationLocation } from '@thymian/core';
import { httpRule, or, protocol } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-userinfo-in-uri')
  .severity('error')
  // Request-side rule (outcome 1, already implemented). It forbids the *sender*
  // from putting userinfo in a generated http/https target URI. It is correctly
  // NOT in `test` (Thymian is the sender there and never emits userinfo, so the
  // check is vacuous and outside user control). It remains a shared
  // static + analytics rule: in `lint` it validates target URIs as *described*
  // in the OpenAPI document (which the API author controls and can wrongly
  // include userinfo), and in `analyze` it validates target URIs in recorded
  // requests from real senders. The union (static + analytics, no test) infers a
  // base ApiContext, so only the common projection is available — which is
  // sufficient here because origin/path are read from the projection and only
  // the URI structure (not header values) is needed. appliesTo names the
  // request roles so the analyze role filter matches HAR requests; it is inert
  // for the static slot. Security-relevant: userinfo is a phishing vector (see
  // PR security section).
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    "A sender MUST NOT generate the userinfo subcomponent (and its '@' delimiter) when an 'http' or 'https' URI reference is generated within a message as a target URI or field value.",
  )
  .appliesTo('client', 'user-agent')
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
