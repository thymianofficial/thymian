import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-may-relay-credentials')
  .severity('hint')
  // A permissive MAY describing internal proxy behavior — a proxy is allowed
  // (but not required) to relay client credentials to the next proxy when
  // proxies cooperatively authenticate. There is no non-conformant condition
  // (relaying and not relaying are both permitted), and the relaying decision
  // is proxy-internal, so there is nothing to validate.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request.',
  )
  .appliesTo('proxy')
  .done();
