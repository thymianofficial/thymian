import { httpRule, type RuleFnResult } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-change-fqdn-hostname')
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT change the host name if the target URI contains a fully qualified domain name. This prevents incorrect routing and ensures the request reaches the intended destination.',
  )
  .summary(
    'Proxy MUST NOT change host name when it is a fully qualified domain name.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // forwarded = request the proxy sent onward; received = request it got.
        const forwarded = trace[i - 1];
        const received = trace[i];
        if (
          !forwarded ||
          !received ||
          forwarded.request.meta.role !== 'proxy'
        ) {
          continue;
        }
        let receivedHost: string;
        let forwardedHost: string;
        try {
          receivedHost = new URL(
            received.request.data.path,
            received.request.data.origin,
          ).hostname;
          forwardedHost = new URL(
            forwarded.request.data.path,
            forwarded.request.data.origin,
          ).hostname;
        } catch {
          continue;
        }
        // Only guard fully qualified domain names (a name, not an IP literal).
        if (
          receivedHost &&
          /[a-zA-Z]/.test(receivedHost) &&
          forwardedHost !== receivedHost
        ) {
          results.push({
            location,
            violation: {
              message: `A proxy changed the target host name while forwarding (received "${receivedHost}", forwarded "${forwardedHost}").`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
