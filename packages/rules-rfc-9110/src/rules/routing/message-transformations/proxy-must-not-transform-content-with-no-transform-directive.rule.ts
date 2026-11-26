import { httpRule, type RuleFnResult } from '@thymian/core';

import {
  compareContent,
  forwardingHops,
  hasNoTransformDirective,
} from '../utils/forwarding.js';

// eslint-disable-next-line thymian-internal/require-rule-tags -- content-integrity preservation with no vocabulary member that fits without forcing one
export default httpRule(
  'rfc9110/proxy-must-not-transform-content-with-no-transform-directive',
)
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT transform the content of a response message that contains a no-transform cache directive. Note that this does not apply to message transformations that do not change the content, such as the addition or removal of transfer codings.',
  )
  .summary(
    'Proxy MUST NOT transform content when no-transform directive is present.',
  )
  .explanation(
    'When a response carries the no-transform cache directive, a proxy must forward its content byte-for-byte and must not alter it, for instance by transcoding or recompressing the payload. That directive is an explicit signal that the exact content matters, which is critical when integrity checks or digital signatures depend on it or for data like medical images and scientific results. Changes that leave the content itself unchanged, such as adding or removing transfer codings, are still allowed. Honoring no-transform is what preserves end-to-end content integrity.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      // Bodies are compared as captured. A source that stores content after
      // content-decoding (as HAR's content.text does) makes a proxy that only
      // adds or removes a content coding look unchanged here; the
      // Content-Encoding change is still reported by
      // proxy-should-not-modify-endpoint-and-representation-headers.
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        // Responses flow upstream -> proxy -> downstream, so the proxy received
        // `outbound.response` from upstream and sent `inbound.response` onward.
        // The directive binds the proxy only if it was on what it received.
        // No Capture Gap guard: an uncaptured Cache-Control can only hide a
        // violation, never invent one.
        const received = outbound.response.data;
        const forwarded = inbound.response.data;
        if (
          hasNoTransformDirective(received.headers) &&
          compareContent(received, forwarded) === 'different'
        ) {
          results.push({
            location,
            violation: {
              message:
                'Proxy transformed the content of a response carrying Cache-Control: no-transform.',
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
