import { httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops } from '../utils/forwarding.js';

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
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        let receivedHost: string;
        let forwardedHost: string;
        try {
          receivedHost = new URL(
            inbound.request.data.path,
            inbound.request.data.origin,
          ).hostname;
          forwardedHost = new URL(
            outbound.request.data.path,
            outbound.request.data.origin,
          ).hostname;
        } catch {
          continue;
        }
        // Only guard fully qualified domain names: an FQDN has at least one dot
        // and at least one letter (which also excludes bare IPv4). An IPv6
        // literal keeps its brackets in URL.hostname, so it is excluded
        // explicitly. A single-label host like "myhost" is not an FQDN, so
        // completing it to a domain is allowed and handled by the sibling rule
        // proxy-may-add-domain-to-non-fqdn-hostname.
        if (
          receivedHost &&
          !receivedHost.startsWith('[') &&
          /[a-zA-Z]/.test(receivedHost) &&
          receivedHost.includes('.') &&
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
