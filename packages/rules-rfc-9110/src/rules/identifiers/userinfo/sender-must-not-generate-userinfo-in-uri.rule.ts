import type { RuleViolationLocation } from '@thymian/core';
import { httpRule, or, protocol } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-userinfo-in-uri')
  .severity('error')
  // Request-side rule (outcome 1, already implemented). It forbids the *sender*
  // from putting userinfo in a generated http/https target URI. It is correctly
  // NOT in `test` (Thymian is the sender there and never emits userinfo, so the
  // check is vacuous and outside user control). It is analytics-only: a `static`
  // (lint) slot would be a guaranteed no-op because the common projection for
  // spec nodes is built by thymianToCommonHttpRequest, which sets
  // `origin = ${protocol}://${host}:${port}` (userinfo already stripped) and
  // `path = node.path` (path only). `new URL(req.path, req.origin)` can therefore
  // never expose a username/password in lint — the userinfo subcomponent is not
  // represented in spec nodes at all, so there is nothing for lint to inspect.
  // The rule is validated only against recorded traffic (`analyze`), where the
  // request comes from a real sender and the full target URI is observable.
  // appliesTo names the request roles so the analyze role filter matches HAR
  // requests (HAR default request role = user-agent). Security-relevant:
  // userinfo is a phishing vector (see PR security section).
  .type('analytics')
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
