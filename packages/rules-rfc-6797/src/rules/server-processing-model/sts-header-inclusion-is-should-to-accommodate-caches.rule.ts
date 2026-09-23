import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc-6797/sts-header-inclusion-is-should-to-accommodate-caches',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A note explaining why the requirement before it is a SHOULD rather than a MUST; it states no requirement a message could meet or break. Sending the header is checked by the server-should-send-sts-header-over-secure-transport convention rule.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'Including the STS header field is stipulated as a "SHOULD" in order to accommodate various server- and network-side caches and load-balancing configurations where it may be difficult to uniformly emit STS header fields on behalf of a given HSTS Host.',
  )
  .summary(
    'Sending Strict-Transport-Security is a SHOULD to accommodate caches and load balancers.',
  )
  .appliesTo('server')
  .done();
