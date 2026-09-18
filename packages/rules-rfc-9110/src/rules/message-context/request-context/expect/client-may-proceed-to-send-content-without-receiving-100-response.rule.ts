import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    'A client that takes this up puts the request content on the wire before any 100 (Continue) arrives, while one that declines holds it back until the interim response shows up. Captured traffic records only the final response, so there is no 100 to order the content against.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that sends a 100-continue expectation is not required to wait for any specific length of time; such a client MAY proceed to send the content even if it has not yet received a response.',
  )
  .appliesTo('client')
  .done();
