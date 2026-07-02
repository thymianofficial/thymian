import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

// The MUST NOT is about a proxy *generating* a Max-Forwards field it did not
// receive. This is observable by correlating adjacent hops of the same request
// chain — the request a proxy received (without Max-Forwards) vs the request it
// forwarded (with a newly added Max-Forwards) — via validateCapturedHttpTraces
// over recorded proxy traffic. It cannot run against static or generated-test
// data, which carries no real cross-hop information.
export default httpRule(
  'rfc9110/proxy-must-not-generate-new-max-forwards-header',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A proxy MUST NOT generate a Max-Forwards header field while forwarding a request unless that request was received with a Max-Forwards field.',
  )
  .appliesTo('proxy')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // prev = the request as received by the proxy;
        // curr = the request as forwarded onward by that proxy.
        const prev = trace[i - 1];
        const curr = trace[i];

        if (!prev || !curr || prev.request.meta.role !== 'proxy') {
          continue;
        }

        const received = getHeader(prev.request.data.headers, 'max-forwards');
        const forwarded = getHeader(curr.request.data.headers, 'max-forwards');

        // Violation: the proxy forwarded a Max-Forwards field even though the
        // request it received did not carry one.
        if (received === undefined && forwarded !== undefined) {
          results.push({ location, violation: {}, findings: [] });
        }
      }

      return results;
    }),
  )
  .done();
