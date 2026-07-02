import { httpRule } from '@thymian/core';

// This MUST governs the internal behavior of a recipient with a clock
// (caches/forwards a response, adding Date if missing). It depends on internal
// recipient state (having a clock) and on what the recipient subsequently does
// downstream, neither of which is observable from a single recorded
// transaction, so there is no non-conformant condition to flag.
export default httpRule('rfc9110/recipient-with-clock-must-add-date-if-missing')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    "A recipient with a clock that receives a response message without a Date header field MUST record the time it was received and append a corresponding Date header field to the message's header section if it is cached or forwarded downstream.",
  )
  .summary(
    'Recipients with a clock MUST add Date header if missing when caching or forwarding.',
  )
  .done();
