import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-may-terminate-request-for-413-response')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#142',
    'A server that takes this up cuts the request off mid-upload, which reaches the wire as a framing-layer reset rather than as an HTTP message, so a captured transaction — a completed request/response pair — does not carry it. The permission is conditioned on the protocol version in use besides, and a rule cannot reach the version token.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'The server MAY terminate the request, if the protocol version in use allows it.',
  )
  .appliesTo('server')
  .done();
