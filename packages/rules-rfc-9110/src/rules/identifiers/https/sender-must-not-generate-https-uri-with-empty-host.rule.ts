import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

import { targetUriHasEmptyHost } from '../utils.js';

export default httpRule(
  'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'https' URI with an empty host identifier.`,
  )
  .appliesTo('client')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('https'),
      (req, _res, location: RuleViolationLocation) => {
        try {
          const isViolation =
            req.target !== undefined
              ? targetUriHasEmptyHost(req.target)
              : new URL(req.path, req.origin).host === '';
          return isViolation ? [{ location, violation: {}, findings: [] }] : [];
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return [];
        }
      },
    ),
  )
  .done();
