import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-authenticate-applies-to-next-client')
  .severity('hint')
  // Informational (outcome 2): this is a statement of fact about the *scope* of
  // the Proxy-Authenticate field (it applies only to the next outbound client
  // on the response chain, unlike WWW-Authenticate). It expresses no
  // requirement and defines no non-conformant condition, so there is nothing to
  // validate on the wire.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'Unlike WWW-Authenticate, the Proxy-Authenticate header field applies only to the next outbound client on the response chain.',
  )
  .appliesTo('proxy')
  .done();
