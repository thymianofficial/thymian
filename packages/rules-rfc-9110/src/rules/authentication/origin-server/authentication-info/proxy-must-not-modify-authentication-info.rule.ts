import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-authentication-info')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST NOT governs a *proxy hop* —
  // a proxy must forward the Authentication-Info response field byte-for-byte.
  // Detecting a violation requires correlating the response a proxy received
  // with the response it forwarded (the inbound and outbound sides of the same
  // hop). That two-sided, per-hop linkage is only available from traffic
  // captured at the proxy itself, so the rule is typed `analytics`, scoped to
  // the `proxy` role, and validated over captured traces by comparing the
  // Authentication-Info value across adjacent hops whose response role is
  // `proxy`.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a response is not allowed to modify the Authentication-Info field value in any way.',
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
          'authentication-info',
        );
        const received = getHeader(
          curr.response.data.headers,
          'authentication-info',
        );

        // A proxy that never received an Authentication-Info field cannot have
        // modified one; only compare when it is present on the inbound side.
        if (received === undefined) {
          continue;
        }

        if (JSON.stringify(forwarded) !== JSON.stringify(received)) {
          results.push({
            location,
            violation: {
              message:
                'A proxy modified the Authentication-Info header field while forwarding the response. A proxy is not allowed to modify the Authentication-Info field value in any way.',
            },
            findings: [],
          });
        }
      }

      return results;
    }),
  )
  .done();
