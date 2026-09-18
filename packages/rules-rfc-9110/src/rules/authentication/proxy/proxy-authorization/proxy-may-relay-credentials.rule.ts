import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-may-relay-credentials')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    "A proxy that takes this up re-emits the client's Proxy-Authorization credentials on the request it forwards to the next proxy, so the decision leaves the proxy and lands on the wire. A captured trace keeps the inbound and the outbound message apart through the role recorded per message, which is how the proxy-must-not-* rules already compare the two. The `hint` — a proxy in a cooperatively authenticating chain dropped the credentials instead of relaying them — is not written yet.",
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request.',
  )
  .appliesTo('proxy')
  .done();
