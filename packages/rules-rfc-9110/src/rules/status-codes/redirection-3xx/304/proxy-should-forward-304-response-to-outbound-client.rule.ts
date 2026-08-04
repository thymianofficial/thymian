import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-forward-304-response-to-outbound-client',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .description(
    'If the conditional request originated with an outbound client, such as a user agent with its own cache sending a conditional GET to a shared proxy, then the proxy SHOULD forward the 304 response to that client.',
  )
  .summary('Proxy SHOULD forward a 304 response to the outbound client.')
  .explanation(
    'When an outbound client (such as a user agent with its own cache) sends a conditional request through a shared proxy and the origin answers 304 Not Modified, the proxy should pass that 304 back to the client rather than substituting a full 200 with a body. This matters because a 304 tells the client its cached copy is still valid; forwarding it lets the client reuse what it already has, which is the whole point of the conditional request and avoids transferring content the client did not need.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // clientFacing = response the proxy returned to the outbound client;
        // originFacing = the exchange between the proxy and the next server.
        const clientFacing = trace[i - 1];
        const originFacing = trace[i];
        if (
          !clientFacing ||
          !originFacing ||
          clientFacing.response.meta.role !== 'proxy'
        ) {
          continue;
        }
        const conditional =
          getHeader(clientFacing.request.data.headers, 'if-none-match') !==
            undefined ||
          getHeader(clientFacing.request.data.headers, 'if-modified-since') !==
            undefined;
        if (
          conditional &&
          originFacing.response.data.statusCode === 304 &&
          clientFacing.response.data.statusCode !== 304
        ) {
          results.push({
            location,
            violation: {
              message: `A proxy received a 304 for a conditional request but returned ${clientFacing.response.data.statusCode} to the outbound client instead of forwarding the 304.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
