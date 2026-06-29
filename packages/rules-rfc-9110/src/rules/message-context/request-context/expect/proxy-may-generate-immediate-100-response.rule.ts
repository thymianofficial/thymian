import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-may-generate-immediate-100-response')
  .severity('hint')
  // Informational (#327): a permissive MAY governing an optional proxy
  // optimisation, predicated on the proxy's private belief about a downstream
  // server's HTTP version. No non-conformant condition exists and the proxy's
  // internal state is unobservable. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'If the proxy believes (from configuration or past interaction) that the next inbound server only supports HTTP/1.0, the proxy MAY generate an immediate 100 (Continue) response to encourage the client to begin sending the content.',
  )
  .appliesTo('proxy')
  .done();
