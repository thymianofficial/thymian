import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

import { targetUriHasEmptyHost } from '../utils.js';

export default httpRule('rfc9110/recipient-must-reject-https-uri-without-host')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A recipient that processes a 'https' URI reference with empty host MUST reject it as invalid.`,
  )
  .explanation(
    'An https URI must name a host (like example.com) in its authority component, because that host identifies the origin server that owns the resource. If a server processes an https URI whose host is empty, it must treat the URI as invalid and reject it rather than acting on it. A hostless https URI identifies no server, so accepting it would leave the request pointing nowhere and could enable ambiguity or misrouting.',
  )
  .appliesTo('server')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('https'),
      (req, res, location: RuleViolationLocation) => {
        try {
          const hasEmptyHost =
            req.target !== undefined
              ? targetUriHasEmptyHost(req.target)
              : new URL(req.path, req.origin).host === '';
          const isViolation =
            hasEmptyHost && !(res.statusCode >= 400 && res.statusCode < 500);
          return isViolation ? [{ location, violation: {}, findings: [] }] : [];
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return [];
        }
      },
    ),
  )
  .done();
