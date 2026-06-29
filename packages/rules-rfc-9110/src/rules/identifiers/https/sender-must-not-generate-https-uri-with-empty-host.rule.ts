import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
)
  .severity('error')
  // Request-side rule (outcome 1, already implemented): it constrains the target
  // URI the *sender* generates. Correctly NOT in `test` (Thymian is the sender
  // there); stays `analytics`, where the request comes from a real recorded
  // client. appliesTo is set to the request roles so the analyze role filter
  // matches HAR requests (HAR default request role = user-agent).
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'https' URI with an empty host identifier.`,
  )
  .appliesTo('client', 'user-agent')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('https'),
      (req, _res, location: RuleViolationLocation) => {
        try {
          const isViolation = new URL(req.path, req.origin).host === '';
          return isViolation ? [{ location, violation: {}, findings: [] }] : [];
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return [];
        }
      },
    ),
  )
  .done();
