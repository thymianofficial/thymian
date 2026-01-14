import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc/proxy-may-generate-immediate-100-response')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'If the proxy believes (from configuration or past interaction) that the next inbound server only supports HTTP/1.0, the proxy MAY generate an immediate 100 (Continue) response to encourage the client to begin sending the content.',
  )
  .appliesTo('proxy')
  .done();
