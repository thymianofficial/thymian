import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-with-clock-must-add-date-if-missing')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'This depends on internal recipient state (having a clock) and on what the recipient subsequently does downstream, neither of which is observable from a single recorded transaction.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    "A recipient with a clock that receives a response message without a Date header field MUST record the time it was received and append a corresponding Date header field to the message's header section if it is cached or forwarded downstream.",
  )
  .summary(
    'Recipients with a clock MUST add Date header if missing when caching or forwarding.',
  )
  .done();
