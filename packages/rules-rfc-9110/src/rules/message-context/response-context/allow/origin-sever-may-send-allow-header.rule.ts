import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-sever-may-send-allow-header')
  .severity('hint')
  // Informational (#327): a permissive MAY — the origin server is free to send
  // an Allow header, or not. The previous rule flagged every response *without*
  // an Allow header as a violation, which inverts the MAY and fires on virtually
  // all conformant traffic. There is no non-conformant condition to detect, so
  // the rule is reclassified informational and ships no rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('Origin server MAY send "Allow" header field in response.')
  .appliesTo('origin server')
  .done();
