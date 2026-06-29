import { httpRule, protocol, type RuleViolationLocation } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-reject-http-uri-without-host')
  .severity('error')
  // Response-/recipient-side rule (outcome 1, already implemented). A violation
  // is an empty-host `http` request that the recipient (server) did NOT reject
  // with a 4xx. This depends on the deployed recipient's behavior, so it is not
  // meaningful in `test` (Thymian generates well-formed requests and the user
  // cannot make it send an empty-host URI) nor in `lint`; it stays `analytics`
  // over recorded traffic. appliesTo includes `origin server` so the analyze
  // role filter matches HAR responses (HAR default response role = origin
  // server); `server` is kept for non-HAR captures.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A recipient that processes a 'http' URI reference with empty host MUST reject it as invalid.`,
  )
  .appliesTo('origin server', 'server')
  .rule((ctx, opts, logger) =>
    ctx.validateHttpTransactions(
      protocol('http'),
      (req, res, location: RuleViolationLocation) => {
        try {
          const isViolation =
            new URL(req.path, req.origin).host === '' &&
            !(res.statusCode >= 400 && res.statusCode < 500);
          return isViolation ? [{ location, violation: {}, findings: [] }] : [];
        } catch (e) {
          logger.error('Cannot run rule because of invalid URL:', e);
          return [];
        }
      },
    ),
  )
  .done();
