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
  .explanation(
    'Whenever a client produces an https URI, that URI must include a non-empty host (such as example.com), because the host identifies the origin server responsible for the resource. Emitting an https URI with an empty host is forbidden. A hostless URI points to no server, so any recipient would be unable to route or resolve it and is required to reject it as invalid, breaking the request.',
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
