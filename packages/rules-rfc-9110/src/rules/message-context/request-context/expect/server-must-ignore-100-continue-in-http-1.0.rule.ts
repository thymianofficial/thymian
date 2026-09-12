import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-must-ignore-100-continue-in-http-1.0')
  .severity('hint')
  // "ignore the expectation" is the absence of a behaviour; a conforming server
  // produces no distinguishing signal, so there is nothing to check from
  // traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives a 100-continue expectation in an HTTP/1.0 request MUST ignore that expectation.',
  )
  .appliesTo('server')
  .done();
