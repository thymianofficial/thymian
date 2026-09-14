import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-may-generate-immediate-100-response')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permission (MAY generate a 100 response), not a testable constraint; there is no violating behaviour to detect.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'If the proxy believes (from configuration or past interaction) that the next inbound server only supports HTTP/1.0, the proxy MAY generate an immediate 100 (Continue) response to encourage the client to begin sending the content.',
  )
  .appliesTo('proxy')
  .done();
