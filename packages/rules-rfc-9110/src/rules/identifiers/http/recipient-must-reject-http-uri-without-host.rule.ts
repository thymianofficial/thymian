import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

import { targetUriHasEmptyHost } from '../utils.js';

export default httpRule('rfc9110/recipient-must-reject-http-uri-without-host')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A recipient that processes a 'http' URI reference with empty host MUST reject it as invalid.`,
  )
  .explanation(
    'An http URI must name a host (like example.com) in its authority component; that host identifies the origin server that owns the resource. If a server receives an http URI whose host is empty, it must treat the URI as invalid and reject it rather than trying to process it. An http URI with no host does not identify any server, so accepting it would leave the request pointing nowhere and could open the door to ambiguity or misrouting.',
  )
  .appliesTo('server')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('http'),
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
