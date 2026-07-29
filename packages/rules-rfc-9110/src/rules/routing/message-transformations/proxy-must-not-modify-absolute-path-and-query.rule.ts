import { httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops } from '../utils/forwarding.js';

const normalizePath = (path: string): string => (path === '' ? '/' : path);

export default httpRule('rfc9110/proxy-must-not-modify-absolute-path-and-query')
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT modify the "absolute-path" and "query" parts of the received target URI when forwarding it to the next inbound server except as required by that forwarding protocol. For example, a proxy forwarding a request to an origin server via HTTP/1.1 will replace an empty path with "/" or "*", depending on the request method.',
  )
  .summary('Proxy MUST NOT modify absolute-path and query parts of target URI.')
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        const receivedPath = normalizePath(inbound.request.data.path);
        const forwardedPath = normalizePath(outbound.request.data.path);
        // Empty-path -> "/" or "*" is an allowed protocol normalization.
        if (
          forwardedPath !== '*' &&
          receivedPath !== '*' &&
          forwardedPath !== receivedPath
        ) {
          results.push({
            location,
            violation: {
              message: `A proxy modified the absolute-path or query while forwarding (received "${receivedPath}", forwarded "${forwardedPath}").`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
