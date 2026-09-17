import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-must-respond-immediately-to-100-continue-request',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    "'Immediate' is a timing property of the origin server's own processing with no wire signature, and distinguishing its response from one a proxy generated needs role attribution the traffic model doesn't carry.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and an indication that request content will follow, an origin server MUST send either an immediate response with a final status code, or an immediate 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
