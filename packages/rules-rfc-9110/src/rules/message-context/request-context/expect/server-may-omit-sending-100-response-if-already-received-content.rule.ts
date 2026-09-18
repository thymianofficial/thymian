import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-omit-sending-100-response-if-already-received-content',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    'A server that takes this up sends no 100 (Continue) at all and goes straight to the final status, where one that declines sends the interim response first. Captured traffic records only the final response, so a rule cannot tell those two apart.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server MAY omit sending a 100 (Continue) response if it has already received some or all of the content for the corresponding request, or if the framing indicates that there is no content.',
  )
  .appliesTo('server')
  .done();
