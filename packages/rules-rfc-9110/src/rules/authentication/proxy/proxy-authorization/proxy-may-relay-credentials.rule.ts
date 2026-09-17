import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-may-relay-credentials')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A permissive MAY describing internal proxy behavior: a proxy may relay client credentials to the next proxy when proxies cooperatively authenticate. Relaying and not relaying are both conformant, and the decision is proxy-internal.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request.',
  )
  .appliesTo('proxy')
  .done();
