import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'http' URI with an empty host identifier.`,
  )
  .appliesTo('client')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('http'),
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
