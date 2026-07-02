import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-www-authenticate')
  .severity('error')
  // This MUST NOT governs a *proxy hop* — a proxy forwarding a response must
  // not alter its WWW-Authenticate header field. Detecting a violation requires
  // correlating the response a proxy received with the response it forwarded
  // (the inbound and outbound sides of the same hop). That two-sided, per-hop
  // linkage is only available from traffic captured at the proxy itself.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // prev = response as the proxy emitted it (outbound hop);
        // curr = response as the proxy received it (inbound hop).
        const prev = trace[i - 1];
        const curr = trace[i];

        if (!prev || !curr || prev.response.meta.role !== 'proxy') {
          continue;
        }

        const forwarded = getHeader(
          prev.response.data.headers,
          'www-authenticate',
        );
        const received = getHeader(
          curr.response.data.headers,
          'www-authenticate',
        );

        // Nothing to compare only when neither hop carried the field. Present
        // on exactly one side means the proxy added or removed it — itself a
        // modification this MUST NOT forbids.
        if (forwarded === undefined && received === undefined) {
          continue;
        }

        if (JSON.stringify(forwarded) !== JSON.stringify(received)) {
          results.push({
            location,
            violation: {
              message:
                'A proxy modified the WWW-Authenticate header field while forwarding the response. A proxy MUST NOT modify WWW-Authenticate header fields in a forwarded response.',
            },
            findings: [],
          });
        }
      }

      return results;
    }),
  )
  .done();
