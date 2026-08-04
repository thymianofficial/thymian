import { httpRule } from '@thymian/core';

/**
 * This MUST NOT governs the internal behavior of a non-origin, non-caching
 * intermediary: it must forward conditional header fields unchanged rather than
 * evaluate them. Conformance is unobservable from the outside — "did not
 * evaluate" leaves no distinguishing signal in a single transaction, and the
 * framework cannot tell whether a given recipient is the origin server or a
 * forwarding intermediary for the target resource. There is no non-conformant
 * condition to detect.
 */
export default httpRule(
  'rfc9110/non-origin-server-must-not-evaluate-conditional-headers',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server that is not the origin server for the target resource and cannot act as a cache for requests on the target resource MUST NOT evaluate the conditional request header fields defined by this specification, and it MUST forward them if the request is forwarded, since the generating client intends that they be evaluated by a server that can provide a current representation.',
  )
  .summary(
    'Non-origin server that cannot act as cache MUST NOT evaluate conditional headers.',
  )
  .appliesTo('intermediary', 'proxy')
  .done();
