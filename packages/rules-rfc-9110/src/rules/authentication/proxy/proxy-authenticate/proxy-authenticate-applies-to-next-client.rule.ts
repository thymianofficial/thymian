import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-authenticate-applies-to-next-client')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A statement of fact about the scope of the Proxy-Authenticate field: it applies only to the next outbound client on the response chain, unlike WWW-Authenticate. It says what the field covers rather than asking any participant to send or withhold it, so no HTTP message can conform to it or violate it. The same section closes the obvious wire-level reading too: where several proxies sit in one administrative domain they each send the same challenge set, so a field that appears to travel further than one hop is exactly what a conformant chain looks like.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'Unlike WWW-Authenticate, the Proxy-Authenticate header field applies only to the next outbound client on the response chain.',
  )
  .appliesTo('proxy')
  .done();
