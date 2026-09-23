import { constant, httpRule, type LiveApiContext } from '@thymian/core';

import { liveStsValues, violation } from '../utils/sts-contexts.js';

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
  .overrideTest(checkLive)
  .overrideAnalyticsRule(checkLive)
  .done();
