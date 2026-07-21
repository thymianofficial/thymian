import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { equalHeaderValues, forwardingHops } from '../utils/forwarding.js';

const REPRESENTATION_HEADERS = [
  'content-type',
  'content-encoding',
  'content-language',
  'content-location',
  'etag',
  'last-modified',
];

export default httpRule(
  'rfc9110/proxy-should-not-modify-endpoint-and-representation-headers',
)
  .severity('warn')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    "A proxy SHOULD NOT modify header fields that provide information about the endpoints of the communication chain, the resource state, or the selected representation (other than the content) unless the field's definition specifically allows such modification or the modification is deemed necessary for privacy or security.",
  )
  .summary('Proxy SHOULD NOT modify endpoint and representation headers.')
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        // For responses the direction reverses: the proxy receives the
        // outbound leg's response from upstream and forwards it downstream
        // as the inbound leg's response.
        const modified = REPRESENTATION_HEADERS.filter((name) => {
          const before = getHeader(outbound.response.data.headers, name);
          const after = getHeader(inbound.response.data.headers, name);
          if (before === undefined && after === undefined) {
            return false;
          }
          return !equalHeaderValues(before, after);
        });
        if (modified.length > 0) {
          results.push({
            location,
            violation: {
              message: `A proxy modified representation metadata header field(s) (${modified.join(', ')}) while forwarding the response.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
