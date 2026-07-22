import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops, headerValues } from '../utils/forwarding.js';

export default httpRule(
  'rfc9110/proxy-may-transform-content-without-no-transform-directive',
)
  .severity('hint')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MAY transform the content of a message that does not contain a no-transform cache directive. A proxy that transforms the content of a 200 (OK) response can inform downstream recipients that a transformation has been applied by changing the response status code to 203 (Non-Authoritative Information).',
  )
  .summary('Proxy MAY transform content without no-transform directive.')
  .appliesTo('proxy')
  // Surfaces use of the optional mechanism: the hint fires when a proxy is
  // observed transforming response content (the body it forwarded downstream
  // differs from the one it received upstream) while no no-transform directive
  // was present - a transformation RFC 9110 permits. The complementary MUST
  // rule proxy-must-not-transform-content-with-no-transform-directive covers
  // the forbidden case where a no-transform directive IS present.
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        // Responses flow upstream -> proxy -> downstream, so the proxy received
        // `outbound.response` from upstream and sent `inbound.response` onward.
        const received = outbound.response.data;
        const forwarded = inbound.response.data;
        if (received.body === undefined || forwarded.body === undefined) {
          continue;
        }
        const noTransform = headerValues(
          getHeader(received.headers, 'cache-control'),
        )
          .flatMap((entry) => entry.split(','))
          .some(
            (directive) => directive.trim().toLowerCase() === 'no-transform',
          );
        if (!noTransform && received.body !== forwarded.body) {
          results.push({ location, violation: {}, findings: [] });
        }
      }
      return results;
    }),
  )
  .done();
