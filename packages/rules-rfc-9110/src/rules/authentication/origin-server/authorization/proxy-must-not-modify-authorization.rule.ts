import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-authorization')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST NOT governs a *proxy hop* —
  // a proxy forwarding a request must not alter its Authorization header field.
  // Detecting a violation requires correlating the request a proxy received
  // with the request it forwarded (the inbound and outbound sides of the same
  // hop). That two-sided, per-hop linkage is only available from traffic
  // captured at the proxy itself, so the rule is typed `analytics`, scoped to
  // the `proxy` role, and validated over captured traces by comparing the
  // Authorization value across adjacent hops whose request role is `proxy`.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a request MUST NOT modify any Authorization header fields in that request.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // prev = request as the proxy emitted it (outbound hop);
        // curr = request as the proxy received it (inbound hop).
        const prev = trace[i - 1];
        const curr = trace[i];

        if (!prev || !curr || prev.request.meta.role !== 'proxy') {
          continue;
        }

        const forwarded = getHeader(prev.request.data.headers, 'authorization');
        const received = getHeader(curr.request.data.headers, 'authorization');

        // A proxy that never received an Authorization field cannot have
        // modified one; only compare when it is present on the inbound side.
        if (received === undefined) {
          continue;
        }

        if (JSON.stringify(forwarded) !== JSON.stringify(received)) {
          results.push({
            location,
            violation: {
              message:
                'A proxy modified the Authorization header field while forwarding the request. A proxy MUST NOT modify Authorization header fields in a forwarded request.',
            },
            findings: [],
          });
        }
      }

      return results;
    }),
  )
  .done();
