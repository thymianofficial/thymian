import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-may-generate-immediate-100-response')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#111',
    'A proxy that takes this up emits a 100 (Continue) of its own towards the client before the next inbound server has said anything, which a trace would carry as an interim response marked with the intermediary role. Interim 1xx responses are not captured as discrete transactions, so that 100 never reaches a rule.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'If the proxy believes (from configuration or past interaction) that the next inbound server only supports HTTP/1.0, the proxy MAY generate an immediate 100 (Continue) response to encourage the client to begin sending the content.',
  )
  .appliesTo('proxy')
  .done();
