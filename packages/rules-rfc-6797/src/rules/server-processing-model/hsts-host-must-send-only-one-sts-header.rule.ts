import { constant, httpRule, type LiveApiContext } from '@thymian/core';

import { liveStsValues, violation } from '../utils/sts-contexts.js';

// Sending the header is what makes a host an HSTS Host (§5.1), so the
// condition in "If an STS header field is included" is met by the very field
// lines this rule counts: exact, never heuristic. `constant(true)` as the
// candidate filter for the same reason as the value rules': `test` picks the
// requests it sends over the described transactions, and a server that adds
// a second field line where the description declares none is the case this
// rule exists for.
function checkLive(ctx: LiveApiContext) {
  return ctx.validateHttpTransactions(constant(true), (_req, res, location) => {
    const fieldLines = liveStsValues(res.headers);
    return fieldLines.length > 1
      ? [
          violation(
            location,
            `This response carries ${fieldLines.length} Strict-Transport-Security header fields (${fieldLines.map((line) => `"${line}"`).join(', ')}). An HSTS Host MUST include only one; a UA processes only the first.`,
          ),
        ]
      : [];
  });
}

// No `static`: an API description declares a response's headers as a map
// keyed by name, which cannot hold two field lines of one header (the
// coverage record's `not-representable` cell).
export default httpRule('rfc-6797/hsts-host-must-send-only-one-sts-header')
  .severity('error')
  .type('test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'If an STS header field is included, the HSTS Host MUST include only one such header field.',
  )
  .summary(
    'HSTS Host must send only one Strict-Transport-Security header field.',
  )
  .explanation(
    'Two Strict-Transport-Security header fields in one response usually mean two layers — the application and a proxy or CDN in front of it — each adding their own. A browser processes only the first and ignores the rest (RFC 6797 §8.1), so which policy takes effect depends on header order, and the one the operator actually configured may be the one that is silently dropped.',
  )
  .appliesTo('server')
  .rule(checkLive)
  .done();
