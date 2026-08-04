import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

import { targetUriHasEmptyHost } from '../utils.js';

export default httpRule(
  'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'http' URI with an empty host identifier.`,
  )
  .explanation(
    'Whenever a client produces an http URI, that URI must include a non-empty host (such as example.com), because the host is what identifies the origin server responsible for the resource. Emitting an http URI with an empty host is forbidden. A hostless URI points to no server at all, so any recipient would be unable to route or resolve it and is required to reject it as invalid, breaking the request.',
  )
  .appliesTo('client')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('http'),
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
